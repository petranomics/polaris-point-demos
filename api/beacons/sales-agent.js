// /api/beacons/sales-agent.js — Sales orchestrator MVP.
//
// POST { task, context? } → { reply, transcript, model }
//   - task: natural-language ask, e.g. "research Acme Corp", "draft outreach to John at Acme"
//   - context: optional prior conversation, lead info, etc.
//
// Architecture: an orchestrator agent (Haiku) routes work to specialist sub-agents
// by calling them as tools. Each sub-agent is itself an Anthropic API call with
// its own system prompt and tool list. The "agents working together" pattern.
//
//   Orchestrator
//        │
//   ┌────┼─────────────┬─────────────────┐
//   ▼    ▼             ▼                 ▼
// research_lead   draft_outreach   summarize_thread
// (+ web_search)  (no tools)        (no tools)
//
// Auth: x-beacons-auth (passcode hash) — same as other Beacons endpoints.

const { neon } = require('@neondatabase/serverless');
const Pricing = require('../../lib/pricing');

const MODEL = 'claude-haiku-4-5';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

// ---- Prompts --------------------------------------------------------------

const ORCHESTRATOR_PROMPT = `You are Pete's sales orchestrator. Pete runs Polaris Point — a one-person web design + AI workspace studio. Your job: take a natural-language ask and route it to the right specialist sub-agent.

You have three specialists available as tools:
- research_lead — given a company name or URL, returns a concise brief (size, news, signals, suggested angle).
- draft_outreach — given prospect context, drafts a short outreach email in Pete's voice.
- summarize_thread — given prior messages/emails, summarizes state and suggests next action.

Rules:
- Use the tools. Don't make up facts about a prospect — call research_lead first.
- Chain tools when useful (e.g., research_lead → draft_outreach for a cold email).
- After tools return, write the final answer to Pete in plain language. Briefly explain what you did and present the output.
- Keep your final reply tight (under 200 words unless the user asked for length).
- No fluff, no preamble. Pete is the only reader.`;

const SUB_AGENT_PROMPTS = {
  research_lead: `You research prospects for Pete's web design studio. Given a company name or URL, use web_search to gather:
- One-line who they are (industry, size if findable).
- Recent news / signals (funding, hiring, product launches, leadership changes).
- Likely pain points relevant to web design / AI workflows.
- Suggested angle for outreach (specific, not generic).

Return ONLY the brief, under 250 words, structured with the four bullets above. No preamble.`,

  draft_outreach: `You draft outreach emails for Pete (Polaris Point). Voice: warm, direct, no jargon, no fluff. 80-120 words.

Structure:
- Open with one specific observation about the prospect (not "I noticed your great work").
- One sentence on what Polaris Point does that's relevant.
- One low-friction CTA (e.g., "worth a 15-min look?", "open to a quick call?").

Return ONLY the email body. No subject line. No signoff. No bracketed placeholders.`,

  summarize_thread: `You summarize sales conversation threads. Given the messages, produce:
- Where things stand (1 sentence).
- What's been agreed (bullets).
- What's pending / awaiting reply (bullets).
- Suggested next action for Pete (1-2 sentences, specific).

Be terse. Bullets OK. Skip pleasantries.`
};

const SUB_AGENT_TOOLS = {
  research_lead:    [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
  draft_outreach:   [],
  summarize_thread: []
};

const ORCHESTRATOR_TOOLS = [
  {
    name: 'research_lead',
    description: 'Research a prospect company. Use whenever the user mentions a company name or URL.',
    input_schema: {
      type: 'object',
      properties: {
        company: { type: 'string', description: 'Company name or URL to research.' },
        focus:   { type: 'string', description: 'Optional. Specific angle (e.g., "their tech stack", "recent funding").' }
      },
      required: ['company']
    }
  },
  {
    name: 'draft_outreach',
    description: 'Draft a cold/warm outreach email given lead context. Call after research_lead when the user wants outreach.',
    input_schema: {
      type: 'object',
      properties: {
        context: { type: 'string', description: 'Lead context — who they are, why now, what they need.' },
        angle:   { type: 'string', description: 'Optional. The specific hook for this email.' }
      },
      required: ['context']
    }
  },
  {
    name: 'summarize_thread',
    description: 'Summarize a conversation history and suggest the next action.',
    input_schema: {
      type: 'object',
      properties: {
        thread: { type: 'string', description: 'The conversation messages, any format.' }
      },
      required: ['thread']
    }
  }
];

// ---- Auth ----------------------------------------------------------------

function checkAuth(req) {
  const expected = process.env.BEACONS_PASSCODE_HASH;
  if (!expected) return false;
  const got = (req.headers['x-beacons-auth'] || '').toString();
  if (got.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < got.length; i++) mismatch |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  return mismatch === 0;
}

// ---- Anthropic call helper -----------------------------------------------

async function callAnthropic({ system, messages, tools, maxTokens = 2048 }) {
  const body = { model: MODEL, max_tokens: maxTokens, system, messages };
  if (tools && tools.length) body.tools = tools;
  const t0 = Date.now();
  const resp = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Anthropic ${resp.status}: ${txt.slice(0, 400)}`);
  }
  const data = await resp.json();
  data._latencyMs = Date.now() - t0;
  return data;
}

async function logIfPossible(sql, opts) {
  if (!sql) return;
  try { await Pricing.logUsage(sql, opts); }
  catch (e) { console.warn('[sales-agent] logUsage failed:', e.message); }
}

// ---- Sub-agent runner ----------------------------------------------------
// Single-call: web_search is a server-side tool, so Anthropic handles the
// search inline. No client-side tool loop needed.

async function runSubAgent(name, input, sql) {
  const system = SUB_AGENT_PROMPTS[name];
  const tools  = SUB_AGENT_TOOLS[name];

  const userPrompt =
    name === 'research_lead'    ? `Research: ${input.company}.${input.focus ? ' Focus: ' + input.focus : ''}` :
    name === 'draft_outreach'   ? `Lead context:\n${input.context}${input.angle ? '\n\nAngle: ' + input.angle : ''}` :
    name === 'summarize_thread' ? `Thread:\n${input.thread}` :
    '';

  const result = await callAnthropic({
    system,
    messages: [{ role: 'user', content: userPrompt }],
    tools,
    maxTokens: 1024
  });

  let webSearches = 0;
  for (const block of (result.content || [])) {
    if (block.type === 'server_tool_use' && block.name === 'web_search') webSearches++;
  }

  await logIfPossible(sql, {
    app: 'beacons',
    endpoint: '/api/beacons/sales-agent',
    userId: 'pete',
    model: MODEL,
    provider: 'anthropic',
    usage: result.usage || {},
    webSearches,
    latencyMs: result._latencyMs,
    metadata: { role: 'subagent', subagent: name }
  });

  const text = (result.content || [])
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('\n')
    .trim();
  return text || '(sub-agent returned empty response)';
}

// ---- Orchestrator loop ---------------------------------------------------

const MAX_TURNS = 6;

async function runOrchestrator(userMessage, sql) {
  const messages = [{ role: 'user', content: userMessage }];
  const transcript = [];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const result = await callAnthropic({
      system: ORCHESTRATOR_PROMPT,
      messages,
      tools: ORCHESTRATOR_TOOLS,
      maxTokens: 2048
    });

    await logIfPossible(sql, {
      app: 'beacons',
      endpoint: '/api/beacons/sales-agent',
      userId: 'pete',
      model: MODEL,
      provider: 'anthropic',
      usage: result.usage || {},
      latencyMs: result._latencyMs,
      metadata: { role: 'orchestrator', turn }
    });

    const content = result.content || [];

    if (result.stop_reason === 'end_turn' || result.stop_reason === 'stop_sequence') {
      const text = content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
      return { reply: text, transcript };
    }

    if (result.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content });
      const toolUses = content.filter(b => b.type === 'tool_use');
      const toolResults = [];
      for (const tu of toolUses) {
        try {
          const out = await runSubAgent(tu.name, tu.input || {}, sql);
          transcript.push({ tool: tu.name, input: tu.input || {}, output: out });
          toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: out });
        } catch (e) {
          transcript.push({ tool: tu.name, input: tu.input || {}, error: e.message });
          toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: 'Error: ' + e.message, is_error: true });
        }
      }
      messages.push({ role: 'user', content: toolResults });
      continue;
    }

    break;
  }

  return { reply: 'Orchestrator hit max turns without finalizing.', transcript };
}

// ---- Handler -------------------------------------------------------------

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-beacons-auth');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  if (!process.env.BEACONS_PASSCODE_HASH) return res.status(500).json({ error: 'BEACONS_PASSCODE_HASH not configured' });
  if (!process.env.ANTHROPIC_API_KEY)     return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  if (!checkAuth(req)) return res.status(401).json({ error: 'Invalid auth' });

  const { task, context } = req.body || {};
  if (!task || typeof task !== 'string') return res.status(400).json({ error: 'Missing or invalid task' });

  const userMessage = context ? `${task}\n\nContext:\n${context}` : task;

  let sql = null;
  if (process.env.DATABASE_URL) {
    try { sql = neon(process.env.DATABASE_URL); await Pricing.ensureUsageTable(sql); }
    catch (e) { console.warn('[sales-agent] DB init failed (non-fatal):', e.message); }
  }

  try {
    const result = await runOrchestrator(userMessage, sql);
    return res.status(200).json({
      reply: result.reply,
      transcript: result.transcript,
      model: MODEL
    });
  } catch (err) {
    console.error('sales-agent error:', err);
    return res.status(500).json({ error: err.message || 'Sales agent failed' });
  }
};
