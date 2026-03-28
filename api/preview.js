// /api/preview.js — Store and retrieve preview configs in the repo
// POST /api/preview { config, template, name } → saves file, returns short URL
// GET /api/preview?id=xxx → returns the config content
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  var token = process.env.GITHUB_TOKEN;
  if (!token) return res.status(500).json({ error: 'GITHUB_TOKEN not configured' });

  var owner = 'petranomics';
  var repo = 'polaris-point-demos';
  var branch = 'main';

  function gh(path, options) {
    options = options || {};
    options.headers = Object.assign({
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'PolarisPoint-Preview'
    }, options.headers || {});
    return fetch('https://api.github.com/repos/' + owner + '/' + repo + '/contents/' + path, options);
  }

  // GET — retrieve a preview config
  if (req.method === 'GET') {
    var id = req.query.id;
    if (!id || !/^[a-z0-9-]+$/.test(id)) return res.status(400).json({ error: 'Invalid preview ID' });

    try {
      var resp = await gh('_previews/' + id + '.json?ref=' + branch);
      if (resp.status !== 200) return res.status(404).json({ error: 'Preview not found' });
      var fileData = await resp.json();
      var content = JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf-8'));

      return res.status(200).json({
        config: content.config,
        template: content.template,
        name: content.name,
        created: content.created
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
      // Generate a short readable ID from the name + random suffix
      var nameSlug = (body.name || 'preview').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 30);
      var suffix = Math.random().toString(36).substring(2, 8);
      var id = nameSlug + '-' + suffix;

      var payload = JSON.stringify({
        config: body.config,
        template: body.template || 'plumber',
        name: body.name || '',
        created: new Date().toISOString()
      });

      var resp = await gh('_previews/' + id + '.json', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Preview: ' + (body.name || id),
          content: Buffer.from(payload).toString('base64'),
          branch: branch
        })
      });

      if (resp.status !== 201) {
        var errData = await resp.json();
        return res.status(500).json({ error: 'Failed to save preview: ' + (errData.message || resp.status) });
      }

      return res.status(200).json({
        id: id,
        url: 'https://polarispoint.io/' + (body.template || 'plumber') + '?p=' + id
      });
    } catch(err) {
      return res.status(500).json({ error: 'Failed to create preview: ' + err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
