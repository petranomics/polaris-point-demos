// /api/site-chat.js — Site-scoped AI popup chat for client websites.
//
// POST { slug, message, history? } -> { response }
//
// Loads the site's stored config (sites.site_config) and builds a tight
// business context, then answers the visitor's question with Claude Haiku.
// Scoped hard: the assistant only speaks for THIS business and, when it
// doesn't know, points the visitor to call or leave a message. Cheap model,
// small token cap, short history — this runs on Pete's API credits.
//
// Env: ANTHROPIC_API_KEY, DATABASE_URL.

const { neon } = require('@neondatabase/serverless');

const MODEL = 'claude-haiku-4-5';
const MAX_MESSAGE_CHARS = 600;
const MAX_HISTORY_TURNS = 8;
const MAX_OUTPUT_TOKENS = 400;

function pickServices(cfg) {
  // Sites store services either as a `services` array or as numbered
  // service1Name/service1Desc … fields. Support both.
  var out = [];
  if (Array.isArray(cfg.services)) {
    cfg.services.forEach(function (s) {
      if (s && (s.name || s.title)) out.push((s.name || s.title) + (s.desc ? ' — ' + s.desc : ''));
    });
  }
  for (var i = 1; i <= 8; i++) {
    var name = cfg['service' + i + 'Name'];
    if (name) out.push(name + (cfg['service' + i + 'Desc'] ? ' — ' + cfg['service' + i + 'Desc'] : ''));
  }
  return out;
}

function pickFaqs(cfg) {
  var out = [];
  if (Array.isArray(cfg.faqs)) {
    cfg.faqs.forEach(function (f) {
      if (f && f.question) out.push('Q: ' + f.question + '\nA: ' + (f.answer || ''));
    });
  }
  return out;
}

function buildContext(cfg) {
  var lines = [];
  var name = cfg.businessName || cfg.businessNameShort || 'this business';
  lines.push('Business: ' + name);
  if (cfg.metaDescription) lines.push('Summary: ' + cfg.metaDescription);
  if (cfg.aboutText) lines.push('About: ' + cfg.aboutText);
  if (cfg.phone) lines.push('Phone: ' + cfg.phone);
  if (cfg.email) lines.push('Email: ' + cfg.email);
  if (cfg.address) lines.push('Address: ' + cfg.address);
  if (cfg.hours) lines.push('Hours: ' + cfg.hours);
  if (Array.isArray(cfg.serviceAreas) && cfg.serviceAreas.length) {
    lines.push('Service areas: ' + cfg.serviceAreas.join(', '));
  } else if (cfg.serviceAreaText) {
    lines.push('Service areas: ' + cfg.serviceAreaText);
  }
  var services = pickServices(cfg);
  if (services.length) lines.push('Services:\n- ' + services.join('\n- '));
  var faqs = pickFaqs(cfg);
  if (faqs.length) lines.push('FAQs:\n' + faqs.join('\n'));
  // Brand voice — guides tone of replies (set in the build-flow intake).
  var brand = cfg.brand || {};
  var brandLines = [];
  if (brand.targetCustomer) brandLines.push('Target customer: ' + brand.targetCustomer);
  if (Array.isArray(brand.differentiators) && brand.differentiators.length) {
    brandLines.push('Key differentiators:\n- ' + brand.differentiators.join('\n- '));
  }
  if (brand.voiceNotes) brandLines.push('Voice notes: ' + brand.voiceNotes);
  if (brandLines.length) lines.push('Brand voice:\n' + brandLines.join('\n'));
  return { name: name, text: lines.join('\n\n') };
}

// Build the persona/tone preamble from the chatbot section of site_config.
// Defaults match the legacy prompt so a site with no chatbot config behaves
// the way it did before this feature shipped.
function buildPersonaPreamble(cfg, name) {
  var c = cfg.chatbot || {};
  var personaMap = {
    friendly:     'Be warm and friendly — like a helpful neighbor.',
    professional: 'Be professional and concise — like a knowledgeable receptionist.',
    casual:       'Be casual and conversational — like a friendly regular.',
    direct:       'Be direct and no-nonsense — get to the point fast.',
    enthusiastic: 'Be upbeat and enthusiastic — show genuine warmth.'
  };
  var voiceMap = {
    we:   'Speak in first person plural ("we", "our team") as if you are part of the business.',
    they: 'Speak in third person about the business ("' + name + ' offers…", "they\'re open until…").'
  };
  var parts = [];
  parts.push(personaMap[c.persona] || personaMap.friendly);
  parts.push(voiceMap[c.voice] || voiceMap.we);
  if (Array.isArray(c.neverSay) && c.neverSay.length) {
    parts.push('IMPORTANT — things you must NEVER do:\n- ' + c.neverSay.join('\n- '));
  }
  if (Array.isArray(c.alwaysSuggest) && c.alwaysSuggest.length) {
    parts.push('Things to suggest when relevant:\n- ' + c.alwaysSuggest.join('\n- '));
  }
  if (c.notes) parts.push('Additional instructions: ' + c.notes);
  return parts.join('\n\n');
}

// Resolve the greeting visible in the widget. Pulled from chatbot.greeting
// first, then falls back to a name-aware default. Surfaced for completeness
// but the actual greeting render lives in shared/automation.js.
function resolveGreeting(cfg, name) {
  var custom = (cfg.chatbot && cfg.chatbot.greeting) || '';
  return custom.trim() || ('Hi! Ask me anything about ' + name + '.');
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'POST only' });
  }
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  if (!process.env.DATABASE_URL) return res.status(500).json({ error: 'DATABASE_URL not configured' });

  var body = req.body || {};
  var slug = (body.slug || '').toString().trim();
  var message = (body.message || '').toString().trim();
  if (!slug) return res.status(400).json({ error: 'slug required' });
  if (!message) return res.status(400).json({ error: 'message required' });
  if (message.length > MAX_MESSAGE_CHARS) message = message.slice(0, MAX_MESSAGE_CHARS);

  // Load the site config
  var cfg;
  try {
    var sql = neon(process.env.DATABASE_URL);
    var rows = await sql`SELECT site_config FROM sites WHERE slug = ${slug} AND status = 'active'`;
    if (!rows.length || !rows[0].site_config) return res.status(404).json({ error: 'Site not found' });
    cfg = typeof rows[0].site_config === 'string' ? JSON.parse(rows[0].site_config) : rows[0].site_config;
  } catch (err) {
    return res.status(500).json({ error: 'Config load failed: ' + err.message });
  }

  // Defense in depth — if the Step 5 chatbot toggle is explicitly off, refuse.
  // The widget won't even render on properly-deployed sites, but a direct API
  // hit (curl, scraping, embedded elsewhere) should still be honored.
  if (cfg.chatbot && cfg.chatbot.enabled === false) {
    return res.status(403).json({ error: 'Chatbot disabled for this site' });
  }

  var ctx = buildContext(cfg);
  var persona = buildPersonaPreamble(cfg, ctx.name);
  var system =
    'You are the virtual assistant for ' + ctx.name + ', embedded on their website. ' +
    'Answer visitor questions using ONLY the business information below. Keep replies concise (2-4 sentences) and helpful. ' +
    'When a visitor wants to book, get a quote, or do something you cannot complete in chat, encourage them to use the booking button, fill out the contact form, or call the business directly. ' +
    'If a question is outside what you know about this business, say so plainly and point them to call or leave a message — never invent prices, availability, policies, or facts. ' +
    'Never discuss anything unrelated to this business.\n\n' +
    '=== TONE & BEHAVIOR ===\n' + persona + '\n\n' +
    '=== BUSINESS INFORMATION ===\n' + ctx.text;

  // Build messages from clamped history + the new turn
  var messages = [];
  var hist = Array.isArray(body.history) ? body.history.slice(-MAX_HISTORY_TURNS) : [];
  hist.forEach(function (m) {
    if (m && (m.role === 'user' || m.role === 'assistant') && m.content) {
      messages.push({ role: m.role, content: String(m.content).slice(0, MAX_MESSAGE_CHARS * 2) });
    }
  });
  // Ensure the last message is the current user turn (avoid dupes if client already appended)
  if (!messages.length || messages[messages.length - 1].role !== 'user' || messages[messages.length - 1].content !== message) {
    messages.push({ role: 'user', content: message });
  }

  try {
    var resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: system,
        messages: messages
      })
    });
    if (!resp.ok) {
      var errText = await resp.text();
      return res.status(502).json({ error: 'AI upstream error', detail: errText.slice(0, 300) });
    }
    var data = await resp.json();
    var text = '';
    if (Array.isArray(data.content)) {
      data.content.forEach(function (b) { if (b.type === 'text') text += b.text; });
    }
    text = (text || '').trim() || 'Sorry, I could not generate a reply just now — please call or leave a message and we\'ll get right back to you.';

    // Best-effort usage log (non-fatal).
    try {
      var Logger = require('../lib/usage-logger.cjs');
      if (Logger && typeof Logger.logUsage === 'function' && data.usage) {
        await Logger.logUsage({
          app: 'site-chat', endpoint: 'site-chat', tenant: slug, model: MODEL, usage: data.usage
        });
      }
    } catch (e) { /* ignore logging failures */ }

    return res.status(200).json({ response: text });
  } catch (err) {
    return res.status(500).json({ error: 'Chat failed: ' + err.message });
  }
};
