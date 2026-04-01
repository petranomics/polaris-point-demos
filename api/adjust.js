// /api/adjust.js — AI-powered config adjustments via Claude API
// Returns a list of find/replace pairs instead of the full config
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
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: 'You are editing a JavaScript website config file. The user wants changes applied.\n\n' +
            'CONFIG:\n```\n' + body.config + '\n```\n\n' +
            'REQUESTED CHANGES: ' + body.prompt + '\n\n' +
            'Return ONLY a JSON array of find-and-replace operations. Each element should have "find" (the exact existing line or lines from the config) and "replace" (the replacement). Example:\n' +
            '[{"find":"  heroHeadline: \\"Old Title\\",","replace":"  heroHeadline: \\"New Title\\","}]\n\n' +
            'Rules:\n' +
            '- "find" must be an EXACT substring that exists in the config above\n' +
            '- Only change what the user asked for — nothing else\n' +
            '- Return valid JSON array only — no markdown, no explanation, no code fences\n' +
            '- For multi-line changes, include the full lines in both find and replace'
        }]
      })
    });

    var data = await response.json();
    if (data.error) {
      return res.status(500).json({ error: data.error.message || 'Claude API error' });
    }

    var text = data.content && data.content[0] ? data.content[0].text : '';

    // Clean markdown fences if present
    text = text.replace(/^```[\w]*\s*\n?/gm, '').replace(/\n?\s*```\s*$/gm, '').trim();

    var patches;
    try {
      patches = JSON.parse(text);
    } catch (e) {
      return res.status(500).json({ error: 'AI returned invalid JSON. Try rephrasing your request.' });
    }

    if (!Array.isArray(patches) || !patches.length) {
      return res.status(500).json({ error: 'AI returned no changes. Try being more specific.' });
    }

    // Apply patches to the config
    var updated = body.config;
    var applied = 0;
    for (var i = 0; i < patches.length; i++) {
      var p = patches[i];
      if (p.find && typeof p.replace === 'string' && updated.includes(p.find)) {
        updated = updated.replace(p.find, p.replace);
        applied++;
      }
    }

    if (applied === 0) {
      return res.status(500).json({ error: 'AI changes could not be matched to config. Try a simpler change.' });
    }

    return res.status(200).json({ config: updated, applied: applied });
  } catch (err) {
    return res.status(500).json({ error: 'AI adjustment failed: ' + err.message });
  }
};
