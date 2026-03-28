// /api/preview.js — Store and retrieve preview configs via GitHub Gists
// POST /api/preview { config, template } → creates gist, returns short ID
// GET /api/preview?id=xxx → returns the config content
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  var token = process.env.GITHUB_TOKEN;
  if (!token) return res.status(500).json({ error: 'GITHUB_TOKEN not configured' });

  // GET — retrieve a preview config
  if (req.method === 'GET') {
    var id = req.query.id;
    if (!id) return res.status(400).json({ error: 'Missing id parameter' });

    try {
      var resp = await fetch('https://api.github.com/gists/' + id, {
        headers: {
          'Authorization': 'Bearer ' + token,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'PolarisPoint-Preview'
        }
      });
      if (resp.status !== 200) return res.status(404).json({ error: 'Preview not found' });
      var gist = await resp.json();
      var file = gist.files['config.js'];
      if (!file) return res.status(404).json({ error: 'Config not found in preview' });

      // Return the raw config content + template info
      var meta = gist.files['meta.json'];
      var template = meta ? JSON.parse(meta.content).template : 'plumber';

      return res.status(200).json({
        config: file.content,
        template: template,
        created: gist.created_at
      });
    } catch(err) {
      return res.status(500).json({ error: 'Failed to load preview: ' + err.message });
    }
  }

  // POST — create a new preview
  if (req.method === 'POST') {
    var body = req.body;
    if (!body || !body.config) return res.status(400).json({ error: 'Missing config' });

    try {
      var resp = await fetch('https://api.github.com/gists', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'PolarisPoint-Preview',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          description: 'Polaris Point Preview — ' + (body.template || 'site'),
          public: false,
          files: {
            'config.js': { content: body.config },
            'meta.json': { content: JSON.stringify({ template: body.template || 'plumber', created: new Date().toISOString() }) }
          }
        })
      });

      var gist = await resp.json();
      if (!gist.id) return res.status(500).json({ error: 'Failed to create preview' });

      return res.status(200).json({
        id: gist.id,
        url: 'https://polarispoint.io/' + (body.template || 'plumber') + '?p=' + gist.id
      });
    } catch(err) {
      return res.status(500).json({ error: 'Failed to create preview: ' + err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
