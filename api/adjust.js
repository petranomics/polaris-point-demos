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
          content: 'You are editing a JavaScript website configuration object. Apply the requested changes and return the COMPLETE updated file.\n\n' +
            'RULES:\n' +
            '- Return ONLY raw JavaScript. No markdown, no code fences, no explanations.\n' +
            '- The output MUST start with exactly "window.siteConfig = {"\n' +
            '- The output MUST end with "};"  \n' +
            '- Keep ALL existing values unchanged unless the user specifically asked to modify them.\n' +
            '- Only change the specific fields the user mentioned.\n' +
            '- Preserve all formatting, quotes, and escape characters.\n\n' +
            'CURRENT CONFIG:\n' + body.config + '\n\n' +
            'REQUESTED CHANGES: ' + body.prompt
        }]
      })
    });

    var data = await response.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message || 'Claude API error' });
    }

    var updatedConfig = data.content && data.content[0] ? data.content[0].text : '';

    // Strip markdown fences if present
    updatedConfig = updatedConfig
      .replace(/^```[\w]*\s*\n?/gm, '')
      .replace(/\n?\s*```\s*$/gm, '')
      .trim();

    // Validate: must start with window.siteConfig
    if (!updatedConfig.startsWith('window.siteConfig')) {
      // Try to find it in the output
      var idx = updatedConfig.indexOf('window.siteConfig');
      if (idx >= 0) {
        updatedConfig = updatedConfig.substring(idx);
      } else {
        return res.status(500).json({ error: 'AI returned invalid config format. Try a simpler change.' });
      }
    }

    // Validate: must end with };
    if (!updatedConfig.trimEnd().endsWith('};')) {
      var lastBrace = updatedConfig.lastIndexOf('};');
      if (lastBrace > 0) {
        updatedConfig = updatedConfig.substring(0, lastBrace + 2);
      } else {
        return res.status(500).json({ error: 'AI returned incomplete config. Try again.' });
      }
    }

    return res.status(200).json({ config: updatedConfig });
  } catch (err) {
    return res.status(500).json({ error: 'AI adjustment failed: ' + err.message });
  }
};
