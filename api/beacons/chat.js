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

// Model routing: Sonnet handles 95% of work cleanly. Opus reserved for deep
// analysis (weekly briefings, market scans, complex strategy). Haiku for
// quick utility (rephrase, tighten, summarize-this-paragraph).
const MODELS = {
  fast: 'claude-haiku-4-5',
  default: 'claude-sonnet-4-6',
  deep: 'claude-opus-4-7'
};
// Library budget per mode (chars; ~4 chars/token). Sonnet's window fits this
// comfortably; Opus deep mode gets a bigger budget for long-form analysis.
const LIBRARY_BUDGET = {
  fast: 60000,
  default: 160000,
  deep: 500000
};

function checkAuth(req) {
  const expected = process.env.BEACONS_PASSCODE_HASH;
  if (!expected) return false;
  const got = (req.headers['x-beacons-auth'] || '').toString();
  if (got.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < got.length; i++) mismatch |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  return mismatch === 0;
}

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
    'You are Beacon, a personal AI assistant for a single user. You operate inside their private workspace and have full context on their work.',
    '',
    'Your core jobs:',
    '  • Draft emails, briefings, and updates in their voice.',
    '  • Summarize meetings, calls, threads, and documents.',
    '  • Generate ideas, angles, and strategic recommendations grounded in their context.',
    '  • Scan their library and projects to surface what\'s relevant for whatever they ask.',
    '  • Research the open web for fresh information when the answer needs it.',
    '  • Stay specific and concrete. Use the actual names, dates, and details from their context — never generic placeholders.',
    '',
    'You have a web_search tool available. Use it when:',
    '  • The user explicitly asks for research, news, market intel, competitor moves, or current pricing.',
    '  • The answer needs information that post-dates your training or wouldn\'t be in their library.',
    '  • A specific external fact materially changes the answer (regulations, official statements, public data).',
    'Do NOT search for things already covered in the user\'s library — their context comes first. When you do search, cite the source URL inline so they can verify. 2–4 searches per question is usually plenty; do not over-search.',
    '',
    'Tone: direct, professional, peer-to-peer. Skip throat-clearing ("Great question!"). Lead with the answer. When drafting on their behalf, match the voice they\'ve described in their directions.',
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

function buildLibraryPrompt(items, budget) {
  const library = items.filter(i => i.kind === 'file' || i.kind === 'thought')
    .sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
  if (!library.length) return null;

  const lines = ['=== LIBRARY (files + thoughts) ===\n'];
  let chars = lines[0].length;
  let truncated = 0;
  for (const item of library) {
    if (chars >= budget) { truncated++; continue; }
    const tag = tagLine(item);
    const body = (item.content || '').trim();
    if (!body) continue;
    const block = '\n' + tag + '\n' + body + '\n';
    if (chars + block.length > budget) {
      const remaining = budget - chars;
      lines.push('\n' + tag + '\n' + body.slice(0, remaining - tag.length - 4) + '\n[...truncated]');
      chars = budget;
      continue;
    }
    lines.push(block);
    chars += block.length;
  }
  if (truncated) lines.push(`\n[Note: ${truncated} additional library items not included in this turn — context limit reached.]`);
  return lines.join('');
}

async function callClaude({ model, systemPrompt, libraryPrompt, history, message }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured on the server');
  }

  // System uses content blocks so we can attach cache_control to the heavy library block.
  const systemBlocks = [{ type: 'text', text: systemPrompt }];
  if (libraryPrompt) {
    systemBlocks.push({
      type: 'text',
      text: libraryPrompt,
      cache_control: { type: 'ephemeral' }
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
  const tools = [{
    type: 'web_search_20250305',
    name: 'web_search',
    max_uses: 6
  }];

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
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

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-beacons-auth');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  if (!process.env.DATABASE_URL) return res.status(500).json({ error: 'DATABASE_URL not configured' });
  if (!process.env.BEACONS_PASSCODE_HASH) return res.status(500).json({ error: 'BEACONS_PASSCODE_HASH not configured' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  if (!checkAuth(req)) return res.status(401).json({ error: 'Invalid or missing auth' });

  const body = req.body || {};
  const message = (body.message || '').toString().trim();
  if (!message) return res.status(400).json({ error: 'Missing message' });
  const history = Array.isArray(body.history) ? body.history.slice(-20) : [];
  const requestedMode = (body.mode || 'default').toString();
  const mode = MODELS[requestedMode] ? requestedMode : 'default';
  const model = MODELS[mode];
  const budget = LIBRARY_BUDGET[mode];

  try {
    const sql = neon(process.env.DATABASE_URL);
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
    const libraryPrompt = buildLibraryPrompt(items, budget);

    const result = await callClaude({ model, systemPrompt, libraryPrompt, history, message });
    return res.status(200).json({ ...result, mode });
  } catch (err) {
    console.error('beacons/chat error', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
};
