// /api/adjust.js — AI-powered config adjustments via Claude API
// Usage: POST /api/adjust { config: "...", prompt: "..." }
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Anthropic API key not configured' });

  var body = req.body;
  if (!body || !body.config || !body.prompt) {
    return res.status(400).json({ error: 'Missing config or prompt' });
  }

  try {
    var response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 8000,
        messages: [{
          role: 'user',
          content: 'You are editing a website configuration file for a local business website. The user wants to make adjustments.\n\n' +
            'CURRENT CONFIG:\n```\n' + body.config + '\n```\n\n' +
            'USER REQUEST: ' + body.prompt + '\n\n' +
            'Return ONLY the complete updated config.js file with the requested changes applied. Do not include markdown code fences, explanations, or anything else — just the raw JavaScript config code starting with "window.siteConfig". Keep all existing values intact unless the user specifically asked to change them.'
        }]
      })
    });

    var data = await response.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message || 'Claude API error' });
    }

    var updatedConfig = data.content && data.content[0] ? data.content[0].text : '';

    // Clean up any accidental markdown fences
    updatedConfig = updatedConfig.replace(/^```[\w]*\n?/gm, '').replace(/\n?```$/gm, '').trim();

    return res.status(200).json({ config: updatedConfig });
  } catch (err) {
    return res.status(500).json({ error: 'AI adjustment failed: ' + err.message });
  }
};
