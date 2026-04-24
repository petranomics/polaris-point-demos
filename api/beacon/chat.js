// /api/beacon/chat.js — Beacon chat endpoint
// POST: send message (pre-fetches context, routes to VPS, logs tokens)
// GET: fetch chat history
const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = neon(process.env.DATABASE_URL);

  try {
    var subId = req.query.subscription_id || (req.body && req.body.subscription_id);
    if (!subId) return res.status(400).json({ error: 'Missing subscription_id' });

    // GET — fetch chat history
    if (req.method === 'GET') {
      var limit = parseInt(req.query.limit) || 50;
      var messages = await sql`
        SELECT role, content, tokens_used, model, created_at
        FROM beacon_messages
        WHERE subscription_id = ${subId}
        ORDER BY created_at ASC
        LIMIT ${limit}
      `;
      return res.json({ messages: messages });
    }

    // POST — send a message
    if (req.method === 'POST') {
      var message = req.body.message;
      if (!message) return res.status(400).json({ error: 'Missing message' });

      // 1. Check subscription is active + has token budget
      var subs = await sql`
        SELECT id, plan, status, tokens_limit, tokens_used
        FROM beacon_subscriptions WHERE id = ${subId}
      `;
      if (!subs.length) return res.status(404).json({ error: 'Subscription not found' });
      var sub = subs[0];
      if (sub.status !== 'active') return res.status(403).json({ error: 'Subscription not active' });
      if (sub.tokens_used >= sub.tokens_limit) {
        return res.status(429).json({
          error: 'Monthly token limit reached',
          tokens_used: sub.tokens_used,
          tokens_limit: sub.tokens_limit
        });
      }

      // 2. Fetch context documents
      var context = await sql`
        SELECT context_type, title, content
        FROM beacon_context
        WHERE subscription_id = ${subId}
        ORDER BY created_at ASC
      `;

      // Extract brand voice if present
      var brandVoice = '';
      var otherContext = [];
      context.forEach(function(c) {
        if (c.context_type === 'brand_voice') {
          brandVoice = c.content;
        } else {
          otherContext.push(c);
        }
      });

      // 3. Fetch recent message history
      var history = await sql`
        SELECT role, content
        FROM beacon_messages
        WHERE subscription_id = ${subId}
        ORDER BY created_at DESC
        LIMIT 20
      `;
      history = history.reverse(); // chronological order

      // 4. Log user message
      await sql`
        INSERT INTO beacon_messages (subscription_id, role, content)
        VALUES (${subId}, 'user', ${message})
      `;

      // 5. Route to VPS agent or Claude API directly
      var result;

      // All tiers use Claude Haiku directly from Vercel (fast, cheap, no VPS hop)
      if (process.env.ANTHROPIC_API_KEY) {
        result = await callClaudeDirect(otherContext, history, message, brandVoice);
      } else {
        // Fallback to VPS Ollama if no API key
        var vpsUrl = process.env.VPS_API_URL || 'https://api.polarispoint.io';
        var vpsSecret = process.env.VPS_API_SECRET || '';

        var vpsResp = await fetch(vpsUrl + '/agent/beacon-chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': vpsSecret
          },
          body: JSON.stringify({
            message: message,
            context: otherContext,
            history: history,
            plan: sub.plan,
            brand_voice: brandVoice
          })
        });

        if (!vpsResp.ok) {
          var errText = await vpsResp.text();
          throw new Error('VPS error: ' + errText);
        }

        result = await vpsResp.json();
      }

      // 6. Log assistant response + debit tokens
      var tokensUsed = result.tokens_used || 0;

      await sql`
        INSERT INTO beacon_messages (subscription_id, role, content, tokens_used, model)
        VALUES (${subId}, 'assistant', ${result.response}, ${tokensUsed}, ${result.model || 'unknown'})
      `;

      await sql`
        UPDATE beacon_subscriptions
        SET tokens_used = tokens_used + ${tokensUsed}, updated_at = NOW()
        WHERE id = ${subId}
      `;

      return res.json({
        response: result.response,
        model: result.model,
        tokens_used: tokensUsed,
        tokens_remaining: sub.tokens_limit - sub.tokens_used - tokensUsed
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// Call Claude API directly from Vercel (for Pro tier)
async function callClaudeDirect(context, history, message, brandVoice) {
  var systemParts = [
    'You are a helpful marketing assistant for a small business. Be concise and actionable.',
    'Match the brand voice when generating content. Never make up facts.'
  ];

  if (brandVoice) systemParts.push('\n== BRAND VOICE ==\n' + brandVoice);

  if (context.length) {
    systemParts.push('\n== BUSINESS CONTEXT ==');
    var chars = 0;
    context.forEach(function(c) {
      if (chars < 40000) {
        var entry = '\n[' + (c.title || c.context_type) + ']\n' + c.content;
        systemParts.push(entry);
        chars += entry.length;
      }
    });
  }

  var claudeMessages = [];
  history.forEach(function(m) {
    if (m.role === 'user' || m.role === 'assistant') {
      claudeMessages.push({ role: m.role, content: m.content });
    }
  });
  claudeMessages.push({ role: 'user', content: message });

  var resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: systemParts.join('\n'),
      messages: claudeMessages
    })
  });

  var data = await resp.json();
  var content = data.content && data.content[0] ? data.content[0].text : '';

  return {
    response: content,
    tokens_used: (data.usage ? data.usage.input_tokens + data.usage.output_tokens : 0),
    model: 'claude-haiku-4-5'
  };
}
