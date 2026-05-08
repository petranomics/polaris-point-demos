// /api/beacons/chat.js — Personal Beacons chat endpoint
//
// POST  body: { message, history?, mode?, projectId? }
//   - Builds the system prompt from directions + active projects + open tasks +
//     all library content (files+thoughts), with prompt caching on the heavy
//     blocks so repeat queries are fast and cheap.
//   - Routes to Anthropic API using ANTHROPIC_API_KEY.
//   - Returns { response, model, usage, cached_tokens }.
//
// Auth: x-beacons-auth header (sha256 of passcode) compared against
//       env var BEACONS_PASSCODE_HASH.

const { neon } = require('@neondatabase/serverless');
const Pricing = require('../../lib/pricing');
const G = require('../../lib/google');
const Tools = require('../../lib/tools');
const Auth = require('../../lib/auth');
const Budget = require('../../lib/budget');
const ModelRouter = require('../../lib/model-router');

// Model routing: Haiku 4.5 across the board. The mode lanes differ only by
// how much of the library we pack in (see LIBRARY_BUDGET below). If a task
// proves to need Sonnet or Opus quality, change the value here for that lane
// and watch the daily cost; until then Haiku is the cost-efficient default.
const MODELS = {
  default: 'claude-haiku-4-5',
  smart: 'claude-haiku-4-5',
  deep: 'claude-haiku-4-5'
};
// Library budget per mode (chars; ~4 chars/token). Bumped from earlier values
// because curated context (forwarded emails + hand-picked Drive files) needs
// room — too tight a budget meant good context got crowded out.
const LIBRARY_BUDGET = {
  default: 120000,
  smart: 240000,
  deep: 600000
};
// Backwards-compat: older clients may still send mode='fast'. Map to default.
const MODE_ALIASES = { fast: 'default' };

function tagLine(item) {
  if (item.kind === 'thought') return `[Thought · ${item.title || 'untitled'}]`;
  if (item.kind === 'file') return `[File · ${item.title}${item.extension ? ' .' + item.extension : ''}]`;
  return `[${item.kind} · ${item.title || ''}]`;
}

function buildSystemPrompt(items) {
  const direction = items.find(i => i.kind === 'direction');
  const projects = items.filter(i => i.kind === 'project').sort((a,b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
  const tasks = items.filter(i => i.kind === 'task');
  const openTasks = tasks.filter(t => t.status !== 'done');
  const inProgress = tasks.filter(t => t.status === 'in_progress');

  const parts = [];

  // ----- BASE PERSONA -----
  parts.push([
    'You are Beacon, a personal AI assistant for a single user. You operate INSIDE their private workspace at beacons.polarispoint.io. The workspace is a real, persistent system with built-in project tracking, task management, and a context library — you are not a chatbot in isolation, you are the conversational layer of a fully-featured assistant tool.',
    '',
    '== THE WORKSPACE YOU LIVE IN ==',
    'The user can do all of these inside the same UI you\'re responding in:',
    '  • PROJECTS: ongoing initiatives with title, description, cadence (weekly/biweekly/monthly/ad-hoc), and status (active/paused/done). The full list is in your context below under ACTIVE PROJECTS.',
    '  • TASKS: discrete work items with title, notes, project link, priority, status (todo/in_progress/done), due date. The full list is in your context below under OPEN TASKS.',
    '  • LIBRARY: files (PDF, DOCX, PPTX, text formats — server-extracted) plus thoughts (free-text notes). The full content is in your context below under LIBRARY.',
    '  • DIRECTIONS: persistent standing instructions from the user. Provided below.',
    '',
    'IMPORTANT — every reply you send has these one-click action buttons under it in the UI:',
    '  • "Save to library" — turns your reply into a persistent thought the user can search and pull from later.',
    '  • "Copy" — clipboard.',
    '  • "Make task" — creates a task with your reply as the brief.',
    '  • "Make project" — creates a new ongoing project with your reply as the description.',
    '  • "→ Google Doc" — creates a Google Doc in their connected Drive (when Google is connected).',
    '  • "→ Sheet" — creates a Google Sheet (treats your reply as text/csv content).',
    '  • "→ Slides" — creates a Google Slides presentation. Splits your reply into slides at markdown headings (# / ##) or "---" separators.',
    '',
    'When a user asks "can you save this" / "turn this into a project" / "track this" / "make a task" / "remind me later" — DO NOT say you can\'t. Point at the right button.',
    '',
    'When a user asks for a presentation / deck / slides:',
    '  1. Structure your reply with one slide per markdown H2 (## Title). First slide should be the title slide.',
    '  2. Each slide: short title (under 8 words) + body content (bullets or 2–4 sentences). Don\'t cram a whole essay onto one slide.',
    '  3. End your reply with: "Click → Slides under this message to drop it into your Google Drive." NEVER say you can\'t make presentations or recommend external tools — the button does it.',
    '',
    'When a user asks for a doc / brief / Word file: write the content cleanly, end with "Click → Google Doc to save it to your Drive." Same for spreadsheets / CSVs / tables — point at "→ Sheet".',
    '',
    '== TOOL USE — operating on real files in their Drive ==',
    'You have a server-side toolkit that lets you actually MODIFY existing files in their Google Drive. This is bigger than the save-as-buttons — you can find templates, clone them, write into specific cells, replace text in slides.',
    '',
    'Available tools:',
    '  • find_drive_file(query) — fuzzy-find a file in their Drive by name. ALWAYS use this first when the user references a file by name ("my Nestlé tracker", "the Q3 deck"). Returns id, name, mimeType, webViewLink for matches.',
    '  • read_sheet_range(file_id, range) — peek at sheet structure BEFORE writing. Use this to find column headers, see where data starts, etc. Range is A1 notation: "Sheet1!A1:Z50".',
    '  • clone_drive_file(file_id, new_name) — copy a Drive file. ALWAYS clone before modifying — never write to the user\'s original template. Naming: descriptive ("Nestlé Q3 2026 Tracker"), not generic ("Copy of Tracker").',
    '  • update_sheet_cells(file_id, range, values) — write values into a Google Sheet. range is A1 notation; values is a 2D array (rows × columns).',
    '  • replace_slide_text(file_id, replacements) — find/replace text across a Google Slides deck. Useful for filling template placeholders ({{client_name}}, [DATE], etc.) — many at once in one batch.',
    '',
    'Tool-use playbook for "fill out my X tracker / template":',
    '  1. find_drive_file with the user\'s query → confirm the file. If multiple match, ask the user to pick.',
    '  2. read_sheet_range / inspect first to understand the structure — don\'t guess at columns.',
    '  3. clone_drive_file with a descriptive name → get a working copy id.',
    '  4. update_sheet_cells (or replace_slide_text) on the CLONE — never the original.',
    '  5. Reply with the new file\'s webViewLink so the user can open it: "Done. New copy here: [link]".',
    '',
    'When tools fail (auth issue, file not found, permission denied), say so plainly and ask the user to verify the connection state. Do NOT silently fall back to "here\'s the text, copy it manually" — that defeats the point of the tools. Either succeed or explain why you couldn\'t.',
    '',
    'The user can also click any task or project in the workspace to open it, and from that detail view click "Run with Beacon" to send the task or project context straight back to you for action — that\'s how on-demand execution works.',
    '',
    'Your core jobs:',
    '  • Draft emails, briefings, and updates in their voice.',
    '  • Summarize meetings, calls, threads, and documents.',
    '  • Generate ideas, angles, and strategic recommendations grounded in their context.',
    '  • Scan their library and projects to surface what\'s relevant for whatever they ask.',
    '  • Research the open web for fresh information when the answer needs it.',
    '  • Help them STRUCTURE work into projects and tasks when they\'re thinking out loud — propose names, descriptions, and cadences they can save with one click.',
    '  • Stay specific and concrete. Use the actual names, dates, and details from their context — never generic placeholders.',
    '',
    'You have web access via the web_search tool — you ARE connected to the internet. Use the tool whenever the user asks for current info, research, news, market intel, competitor moves, or pricing. Don\'t hedge or say "I can\'t access the internet" — the tool exists, use it. If the tool returns an error, say PLAINLY what failed (e.g., "web search returned a network_error — I\'ll try a different query / fall back to your library") rather than claiming you don\'t have access. Try a different query if the first errors. Don\'t search for things already covered in the library. Cite source URLs inline. 2–4 searches per question is plenty.',
    '',
    'Tone: direct, professional, peer-to-peer. Skip throat-clearing ("Great question!"). Lead with the answer. When drafting on their behalf, match the voice they\'ve described in their directions.',
    '',
    'Write like a human, not an AI. Avoid the patterns that scream "ChatGPT":',
    '  • No em-dash overuse. Periods, commas, and parentheses do most jobs better.',
    '  • No "not just X — but Y" / "more than just" rhythms. They\'re a tic.',
    '  • No filler intros ("In today\'s fast-paced world", "It\'s worth noting that"). Cut to the point.',
    '  • No inflated symbolism ("a beacon of", "a tapestry of", "delve into the realm of").',
    '  • No rule-of-three padding when two are enough.',
    '  • Avoid AI-vocabulary words: leverage, robust, navigate, foster, synergy, unparalleled, transformative, holistic, paradigm, ecosystem, journey (when used metaphorically), seamless, vibrant, pivotal.',
    '  • Use active voice. Concrete verbs. Specific nouns.',
    '  • Vary sentence length. Don\'t end every other sentence with a participial phrase ("delivering value", "ensuring success").',
    '  • If a line could survive being cut, cut it.',
    '',
    'Output formatting:',
    '  • For drafts (emails, posts, briefs), output the draft only. No preamble like "Here\'s your draft:".',
    '  • For analysis or recommendations, use plain prose. Headers and bullets only when they earn their place.',
    '  • Cite specific items from context when relevant: "per [Q3 Nestlé deck]", "from your Apr 22 meeting note". Cite web sources by URL.',
    '',
    'When asked something you can\'t determine from context or the web, say so plainly and ask for the missing piece. Do not invent facts about people, brands, prices, or events.',
  ].join('\n'));

  // ----- USER DIRECTIONS -----
  if (direction && direction.content) {
    parts.push('\n\n=== USER\'S STANDING DIRECTIONS ===\n' + direction.content);
  }

  // ----- PROJECTS -----
  if (projects.length) {
    parts.push('\n\n=== ACTIVE PROJECTS ===');
    projects.filter(p => p.status === 'active').forEach(p => {
      parts.push(`\n• ${p.title} (${p.cadence || 'weekly'})`);
      if (p.content) parts.push('  ' + p.content.split('\n').join('\n  '));
    });
    const paused = projects.filter(p => p.status === 'paused');
    if (paused.length) {
      parts.push('\nPaused: ' + paused.map(p => p.title).join(', '));
    }
  }

  // ----- TASKS -----
  if (openTasks.length) {
    parts.push('\n\n=== OPEN TASKS ===');
    if (inProgress.length) {
      parts.push('In progress:');
      inProgress.forEach(t => {
        const proj = t.project_id ? projects.find(p => p.id === t.project_id) : null;
        parts.push(`  ◐ ${t.title}${proj ? ' [' + proj.title + ']' : ''}${t.due_date ? ' (due ' + t.due_date + ')' : ''}`);
        if (t.content) parts.push('     ' + t.content.split('\n').slice(0, 3).join(' / '));
      });
    }
    const todo = openTasks.filter(t => t.status === 'todo');
    if (todo.length) {
      parts.push('To do:');
      todo.forEach(t => {
        const proj = t.project_id ? projects.find(p => p.id === t.project_id) : null;
        parts.push(`  ☐ ${t.title}${proj ? ' [' + proj.title + ']' : ''}${t.due_date ? ' (due ' + t.due_date + ')' : ''}${t.priority === 'high' ? ' [HIGH]' : ''}`);
      });
    }
  }

  return parts.join('\n');
}

// Score one item for relevance to the current query. Title hits weighted
// 5x. Caps per-token contribution at 5 to avoid spam-bias from one giant
// thread that mentions a common word a hundred times. Body sample limited
// to first 2000 chars to keep scoring fast on large libraries.
function scoreRelevance(item, queryTokens) {
  if (!queryTokens.length) return 0;
  const title = (item.title || '').toLowerCase();
  const sample = (item.content || '').slice(0, 2000).toLowerCase();
  let score = 0;
  for (const tok of queryTokens) {
    if (title.includes(tok)) score += 5;
    if (sample.includes(tok)) {
      let hits = 0;
      let idx = 0;
      while ((idx = sample.indexOf(tok, idx)) !== -1 && hits < 5) { hits++; idx += tok.length; }
      score += hits;
    }
  }
  return score;
}

function buildLibraryPrompt(items, budget, message, history) {
  const library = items.filter(i => i.kind === 'file' || i.kind === 'thought' || i.kind === 'email_thread');
  if (!library.length) return null;

  const queryText = ((message || '') + ' ' +
    (Array.isArray(history) ? history.slice(-3).map(h => h.content || '').join(' ') : ''))
    .toLowerCase();
  const queryTokens = Array.from(new Set(
    queryText.split(/[^a-z0-9]+/).filter(t => t.length >= 3)
  ));

  const scored = library.map(item => ({
    item,
    score: scoreRelevance(item, queryTokens),
    age: Date.now() - new Date(item.created_at).getTime(),
    pinned: !!item.pinned
  })).sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (b.score !== a.score) return b.score - a.score;
    return a.age - b.age;
  });

  const lines = ['=== LIBRARY (pinned + most relevant first) ===\n'];
  let chars = lines[0].length;
  const kindUsed = { file: 0, thought: 0, email_thread: 0 };
  // Per-kind cap: no single kind eats more than 60% of budget on the first
  // pass. Stops Gmail volume from crowding out hand-picked PDFs.
  const PER_KIND_CAP = Math.floor(budget * 0.6);
  const addedIds = new Set();

  function tryAdd(item, isPinned, respectKindCap) {
    if (addedIds.has(item.id)) return false;
    if (chars >= budget) return false;
    if (respectKindCap && (kindUsed[item.kind] || 0) >= PER_KIND_CAP) return false;
    const tag = tagLine(item) + (isPinned ? ' [PINNED]' : '');
    const body = (item.content || '').trim();
    if (!body) return false;
    const block = '\n' + tag + '\n' + body + '\n';
    if (chars + block.length > budget) {
      const remaining = budget - chars;
      if (remaining > tag.length + 100) {
        lines.push('\n' + tag + '\n' + body.slice(0, remaining - tag.length - 12) + '\n[...truncated]');
      }
      chars = budget;
      addedIds.add(item.id);
      return true;
    }
    lines.push(block);
    chars += block.length;
    kindUsed[item.kind] = (kindUsed[item.kind] || 0) + block.length;
    addedIds.add(item.id);
    return true;
  }

  // Pass 1: pinned items, no kind cap.
  for (const { item, pinned } of scored) {
    if (pinned) tryAdd(item, true, false);
  }
  // Pass 2: by relevance, respecting per-kind cap.
  for (const { item } of scored) tryAdd(item, false, true);
  // Pass 3: relax kind cap, fill remaining slots greedily.
  for (const { item } of scored) {
    if (chars >= budget) break;
    tryAdd(item, false, false);
  }

  const remaining = scored.filter(s => !addedIds.has(s.item.id) && (s.item.content || '').trim()).length;
  if (remaining > 0) {
    lines.push(`\n[Note: ${remaining} more library items in your archive — ask about a specific topic, or pin items via the library to anchor them in every chat.]`);
  }
  return lines.join('');
}

async function callClaude({ model, systemPrompt, libraryPrompt, history, message, webSearchEnabled = true }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured on the server');
  }

  // System uses content blocks so we can attach cache_control to the heavy
  // library block. 1-hour TTL fits ad-hoc usage (chat through the workday,
  // not just in 5-min bursts) — initial cache write costs 2x but each hit
  // pays back fast vs. the 5-min default.
  const systemBlocks = [{ type: 'text', text: systemPrompt }];
  if (libraryPrompt) {
    systemBlocks.push({
      type: 'text',
      text: libraryPrompt,
      cache_control: { type: 'ephemeral', ttl: '1h' }
    });
  }

  const messages = [];
  if (Array.isArray(history)) {
    history.forEach(m => {
      if (m && (m.role === 'user' || m.role === 'assistant') && m.content) {
        messages.push({ role: m.role, content: String(m.content) });
      }
    });
  }
  messages.push({ role: 'user', content: String(message) });

  // Server-side web search tool. Anthropic runs the search loop; we get the
  // final answer back with citations embedded in the text blocks.
  // Tenant can disable web_search in Settings → toggle.
  const tools = [];
  if (webSearchEnabled) {
    tools.push({
      type: 'web_search_20250305',
      name: 'web_search',
      max_uses: 6
    });
  }

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'extended-cache-ttl-2025-04-11',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      tools,
      system: systemBlocks,
      messages
    })
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error('Anthropic API error: ' + resp.status + ' ' + errText.slice(0, 400));
  }
  const data = await resp.json();
  const blocks = data.content || [];
  const text = blocks.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();

  // Surface what the model searched so the UI can show "Searched N sources"
  const searchUrls = [];
  blocks.forEach(b => {
    if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) {
      b.content.forEach(r => { if (r && r.url) searchUrls.push({ url: r.url, title: r.title || '' }); });
    }
  });

  return {
    response: text,
    model: data.model || model,
    usage: data.usage || {},
    searchCount: searchUrls.length,
    searchSources: searchUrls.slice(0, 10)
  };
}

// Streaming agent loop: streams text tokens to the client, but also handles
// multi-turn tool-use cycles. When the model invokes a tool (find_drive_file,
// clone_drive_file, update_sheet_cells, replace_slide_text, read_sheet_range),
// we stream a tool_progress event, execute the tool server-side, feed the
// result back as tool_result, and let the model continue. Cap at MAX_TURNS
// to prevent runaway loops.
const MAX_AGENT_TURNS = 6;

async function streamClaude({ model, systemPrompt, libraryPrompt, history, message, res, mode, sql, accessToken, tenant, webSearchEnabled = true }) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured');

  const systemBlocks = [{ type: 'text', text: systemPrompt }];
  if (libraryPrompt) {
    systemBlocks.push({ type: 'text', text: libraryPrompt, cache_control: { type: 'ephemeral', ttl: '1h' } });
  }
  const messages = [];
  if (Array.isArray(history)) {
    history.forEach(m => {
      if (m && (m.role === 'user' || m.role === 'assistant') && m.content) {
        messages.push({ role: m.role, content: String(m.content) });
      }
    });
  }
  messages.push({ role: 'user', content: String(message) });

  const tools = [];
  if (webSearchEnabled) {
    tools.push({
      type: 'web_search_20250305',
      name: 'web_search',
      max_uses: 6,
      user_location: { type: 'approximate', country: 'US' }
    });
  }
  if (accessToken) {
    Tools.TOOL_DEFINITIONS.forEach(d => tools.push(d));
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  const send = (payload) => res.write('data: ' + JSON.stringify(payload) + '\n\n');
  send({ type: 'meta', model, mode, toolsAvailable: tools.length });

  const totalUsage = {
    input_tokens: 0,
    output_tokens: 0,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0
  };
  const searchSources = [];
  const toolsUsed = [];
  let resolvedModel = model;

  for (let turn = 0; turn < MAX_AGENT_TURNS; turn++) {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'extended-cache-ttl-2025-04-11',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        tools,
        system: systemBlocks,
        messages,
        stream: true
      })
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      send({ type: 'error', error: 'Upstream ' + upstream.status + ': ' + errText.slice(0, 300) });
      res.end();
      return;
    }

    // Parse one streaming turn. Track text deltas, tool_use blocks (with
    // their JSON input), and the stop_reason that ends the turn.
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const turnContent = [];           // assistant content blocks for this turn
    const turnToolUses = [];          // tool_use blocks needing execution
    let currentBlock = null;          // block-in-progress
    let stopReason = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop();

      for (const evt of events) {
        const lines = evt.split('\n');
        let eventType = '', dataStr = '';
        for (const ln of lines) {
          if (ln.startsWith('event: ')) eventType = ln.slice(7).trim();
          else if (ln.startsWith('data: ')) dataStr = ln.slice(6);
        }
        if (!dataStr) continue;
        let data;
        try { data = JSON.parse(dataStr); } catch (e) { continue; }

        if (eventType === 'message_start' && data.message) {
          if (data.message.model) resolvedModel = data.message.model;
          if (data.message.usage) {
            totalUsage.input_tokens += data.message.usage.input_tokens || 0;
            totalUsage.cache_creation_input_tokens += data.message.usage.cache_creation_input_tokens || 0;
            totalUsage.cache_read_input_tokens += data.message.usage.cache_read_input_tokens || 0;
          }
        } else if (eventType === 'content_block_start' && data.content_block) {
          const cb = data.content_block;
          if (cb.type === 'tool_use') {
            currentBlock = { type: 'tool_use', id: cb.id, name: cb.name, _inputAcc: '' };
            send({ type: 'tool_started', name: cb.name });
          } else if (cb.type === 'web_search_tool_use') {
            currentBlock = { type: 'web_search_tool_use' };
            send({ type: 'search_started' });
            send({ type: 'tool_started', name: 'web_search' });
          } else if (cb.type === 'text') {
            currentBlock = { type: 'text', text: '' };
          } else if (cb.type === 'web_search_tool_result') {
            // Result content can be either an array of search hits OR an
            // error object like { type: 'web_search_tool_result_error',
            // error_code: 'network_error' } when the tool fails.
            currentBlock = { type: 'web_search_tool_result', content: cb.content || [] };
          } else {
            currentBlock = { type: cb.type };
          }
        } else if (eventType === 'content_block_delta' && data.delta) {
          if (data.delta.type === 'text_delta' && data.delta.text) {
            if (currentBlock && currentBlock.type === 'text') currentBlock.text += data.delta.text;
            send({ type: 'text', text: data.delta.text });
          } else if (data.delta.type === 'input_json_delta' && data.delta.partial_json) {
            if (currentBlock && currentBlock.type === 'tool_use') {
              currentBlock._inputAcc += data.delta.partial_json;
            }
          }
        } else if (eventType === 'content_block_stop') {
          if (currentBlock) {
            if (currentBlock.type === 'tool_use') {
              let input = {};
              try { input = currentBlock._inputAcc ? JSON.parse(currentBlock._inputAcc) : {}; } catch (e) { /* keep empty */ }
              const block = { type: 'tool_use', id: currentBlock.id, name: currentBlock.name, input };
              turnContent.push(block);
              turnToolUses.push(block);
            } else if (currentBlock.type === 'text') {
              turnContent.push({ type: 'text', text: currentBlock.text });
            } else if (currentBlock.type === 'web_search_tool_result') {
              const content = currentBlock.content;
              if (Array.isArray(content)) {
                // Successful search — extract the hits
                content.forEach(r => {
                  if (r && r.url) searchSources.push({ url: r.url, title: r.title || '' });
                });
                send({ type: 'tool_progress', name: 'web_search', status: 'done' });
                turnContent.push({ type: 'web_search_tool_result', content });
              } else if (content && content.type === 'web_search_tool_result_error') {
                // Search itself errored. Log the actual error and surface a
                // useful chip so the user knows WHY web access failed.
                const errCode = content.error_code || 'unknown';
                console.warn('web_search tool error:', errCode, JSON.stringify(content));
                send({ type: 'tool_progress', name: 'web_search', status: 'error', error: errCode });
                turnContent.push({ type: 'web_search_tool_result', content });
              } else {
                console.warn('Unexpected web_search content shape:', JSON.stringify(content).slice(0, 200));
                turnContent.push({ type: 'web_search_tool_result', content: content || [] });
              }
            } else {
              // pass-through for other block types
              turnContent.push({ type: currentBlock.type });
            }
          }
          currentBlock = null;
        } else if (eventType === 'message_delta') {
          if (data.delta && data.delta.stop_reason) stopReason = data.delta.stop_reason;
          if (data.usage) totalUsage.output_tokens += data.usage.output_tokens || 0;
        }
      }
    }

    // Persist the assistant turn so it can be threaded into the next call.
    if (turnContent.length) messages.push({ role: 'assistant', content: turnContent });

    // If the turn ended without tool calls, we're done.
    const customToolUses = turnToolUses.filter(tu => Tools.EXECUTORS[tu.name]);
    if (stopReason !== 'tool_use' || !customToolUses.length) break;

    // Execute each requested tool, collect results.
    const toolResults = [];
    for (const tu of customToolUses) {
      try {
        send({ type: 'tool_progress', name: tu.name, status: 'running', input: tu.input });
        const result = await Tools.executeTool(tu.name, tu.input, accessToken);
        toolsUsed.push({ name: tu.name, input: tu.input, ok: true });
        send({ type: 'tool_progress', name: tu.name, status: 'done' });
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: JSON.stringify(result).slice(0, 12000)
        });
      } catch (e) {
        const errMsg = e && e.message ? e.message : String(e);
        toolsUsed.push({ name: tu.name, input: tu.input, ok: false, error: errMsg });
        send({ type: 'tool_progress', name: tu.name, status: 'error', error: errMsg });
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: JSON.stringify({ error: errMsg }),
          is_error: true
        });
      }
    }
    messages.push({ role: 'user', content: toolResults });
    // Loop continues — model gets the tool results and reasons further.
  }

  // Log usage before res.end so the function doesn't recycle mid-write.
  let costUsd = 0;
  try {
    if (sql) {
      costUsd = await Pricing.logUsage(sql, {
        app: 'beacons',
        endpoint: '/api/beacons/chat',
        tenant: tenant ? tenant.id : null,
        userId: tenant ? tenant.id : null,
        model: resolvedModel,
        mode,
        provider: 'anthropic',
        usage: totalUsage,
        webSearches: searchSources.length,
        metadata: { stream: true, tools_used: toolsUsed }
      });
    }
  } catch (e) {
    console.error('usage log failed (stream)', e);
  }

  send({
    type: 'done',
    model: resolvedModel,
    searchCount: searchSources.length,
    searchSources: searchSources.slice(0, 10),
    toolsUsed,
    costUsd
  });
  res.end();
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-beacons-auth');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  if (!process.env.DATABASE_URL) return res.status(500).json({ error: 'DATABASE_URL not configured' });
  if (!process.env.BEACONS_JWT_SECRET) return res.status(500).json({ error: 'BEACONS_JWT_SECRET not configured' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  const tenant = await Auth.resolveTenant(req);
  if (!tenant) return res.status(401).json({ error: 'Invalid or missing auth' });
  const webSearchEnabled = Auth.effectiveSettings(tenant).web_search_enabled !== false;

  const body = req.body || {};
  const message = (body.message || '').toString().trim();
  if (!message) return res.status(400).json({ error: 'Missing message' });
  const history = Array.isArray(body.history) ? body.history.slice(-20) : [];
  const requestedMode = (body.mode || 'default').toString();
  const aliasedMode = MODE_ALIASES[requestedMode] || requestedMode;
  const mode = MODELS[aliasedMode] ? aliasedMode : 'default';
  const budget = LIBRARY_BUDGET[mode];

  try {
    const sql = neon(process.env.DATABASE_URL);

    // Pre-flight budget check. Pull the tenant's MTD spend before letting
    // them spend more. If over_cap, surface a clear error so the client can
    // show "monthly limit reached, upgrade for more."
    await Pricing.ensureUsageTable(sql);
    const budgetState = await Budget.checkBudget(sql, tenant);
    Budget.applyBudgetHeaders(res, budgetState);
    if (budgetState.over_cap) {
      return res.status(402).json({
        error: 'Monthly usage cap reached for this account.',
        budget: budgetState
      });
    }

    // Triage to a model based on tenant tier + budget left + requested mode.
    // Replaces the static MODELS map with dynamic routing.
    const routed = ModelRouter.selectModel({
      task: body.task || 'chat',
      tenant,
      budgetLeftPct: 100 - budgetState.used_pct,
      mode
    });
    const model = routed.provider === 'anthropic' ? routed.model : MODELS[mode];
    // Note: Ollama provider routing isn't wired through streamClaude yet —
    // the Ollama path needs its own call branch. For now, if the router picks
    // Ollama, we still call Anthropic Haiku to keep the chat experience
    // working. The router is in place; the Ollama execution layer comes next.

    // Make sure the table exists (in case chat is hit before items endpoint)
    await sql`
      CREATE TABLE IF NOT EXISTS beacons_items (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        kind TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    const rows = await sql`SELECT data FROM beacons_items ORDER BY created_at DESC`;
    const items = rows.map(r => r.data);

    const systemPrompt = buildSystemPrompt(items);
    const libraryPrompt = buildLibraryPrompt(items, budget, message, history);

    // If Google is connected, the agent can wield Drive/Sheets/Slides tools.
    // Pull a fresh access token (auto-refreshes if expired) before kicking
    // off the chat call. Failure here is non-fatal — chat still works
    // without those tools, just web_search.
    let accessToken = null;
    try {
      await G.ensureSchema();
      accessToken = await G.getValidAccessToken();
    } catch (e) {
      console.warn('Could not fetch Google access token for chat tools:', e.message);
    }

    if (body.stream === true) {
      await streamClaude({ model, systemPrompt, libraryPrompt, history, message, res, mode, sql, accessToken, tenant, webSearchEnabled });
      return;
    }

    const result = await callClaude({ model, systemPrompt, libraryPrompt, history, message, webSearchEnabled });
    let costUsd = 0;
    try {
      costUsd = await Pricing.logUsage(sql, {
        app: 'beacons',
        endpoint: '/api/beacons/chat',
        tenant: tenant ? tenant.id : null,
        userId: tenant ? tenant.id : null,
        model: result.model,
        mode,
        provider: 'anthropic',
        usage: result.usage,
        webSearches: result.searchCount,
        metadata: { stream: false }
      });
    } catch (e) {
      console.error('usage log failed (non-stream)', e);
    }
    return res.status(200).json({ ...result, mode, costUsd });
  } catch (err) {
    console.error('beacons/chat error', err);
    if (body.stream === true && !res.headersSent) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.write('data: ' + JSON.stringify({ type: 'error', error: err.message || 'Internal error' }) + '\n\n');
      return res.end();
    }
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
};
