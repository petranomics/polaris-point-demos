// /api/preview.js — Store, retrieve, list, and delete preview configs
// POST /api/preview { config, template, name } → saves file, returns short URL
// GET /api/preview?id=xxx → returns the config content
// GET /api/preview?list=true → lists all previews
// DELETE /api/preview?id=xxx → deletes a preview
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
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

  // GET — retrieve a single preview or list all
  if (req.method === 'GET') {
    // List all previews
    if (req.query.list === 'true') {
      try {
        var resp = await gh('_previews?ref=' + branch);
        if (resp.status !== 200) return res.status(200).json({ previews: [] });
        var files = await resp.json();
        if (!Array.isArray(files)) return res.status(200).json({ previews: [] });

        var previews = [];
        for (var i = 0; i < files.length; i++) {
          var f = files[i];
          if (!f.name.endsWith('.json')) continue;
          var id = f.name.replace('.json', '');
          // Fetch content to get name, template, created
          try {
            var r = await gh('_previews/' + f.name + '?ref=' + branch);
            if (r.status === 200) {
              var d = await r.json();
              var content = JSON.parse(Buffer.from(d.content, 'base64').toString('utf-8'));
              previews.push({
                id: id,
                name: content.name || id,
                template: content.template || 'plumber',
                created: content.created || '',
                size: f.size
              });
            }
          } catch(e) {
            previews.push({ id: id, name: id, template: '', created: '', size: f.size });
          }
        }
        // Sort newest first
        previews.sort(function(a, b) { return (b.created || '').localeCompare(a.created || ''); });
        return res.status(200).json({ previews: previews, count: previews.length });
      } catch(err) {
        return res.status(500).json({ error: 'Failed to list previews: ' + err.message });
      }
    }

    // Get single preview
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

  // POST — create a new preview, OR update an existing one if body.id is given.
  // Updates require the existing file's SHA per the GitHub Contents API.
  if (req.method === 'POST') {
    var body = req.body;
    if (!body || !body.config) return res.status(400).json({ error: 'Missing config' });

    try {
      var id;
      var existingSha = null;
      var providedId = body.id && /^[a-z0-9-]+$/.test(body.id) ? body.id : null;

      if (providedId) {
        id = providedId;
        var existing = await gh('_previews/' + id + '.json?ref=' + branch);
        if (existing.status === 200) {
          var fileData = await existing.json();
          existingSha = fileData.sha;
        }
        // If the file is gone, fall through and create it under the same id.
      } else {
        var nameSlug = (body.name || 'preview').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 30);
        var suffix = Math.random().toString(36).substring(2, 8);
        id = nameSlug + '-' + suffix;
      }

      var payload = JSON.stringify({
        config: body.config,
        template: body.template || 'plumber',
        name: body.name || '',
        created: new Date().toISOString()
      });

      var ghBody = {
        message: (existingSha ? 'Update preview: ' : 'Preview: ') + (body.name || id),
        content: Buffer.from(payload).toString('base64'),
        branch: branch
      };
      if (existingSha) ghBody.sha = existingSha;

      var resp = await gh('_previews/' + id + '.json', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ghBody)
      });

      if (resp.status !== 201 && resp.status !== 200) {
        var errData = await resp.json();
        return res.status(500).json({ error: 'Failed to save preview: ' + (errData.message || resp.status) });
      }

      return res.status(200).json({
        id: id,
        url: 'https://polarispoint.io/' + (body.template || 'plumber') + '?p=' + id,
        updated: !!existingSha
      });
    } catch(err) {
      return res.status(500).json({ error: 'Failed to save preview: ' + err.message });
    }
  }

  // DELETE — remove a preview
  if (req.method === 'DELETE') {
    var id = req.query.id;
    if (!id || !/^[a-z0-9-]+$/.test(id)) return res.status(400).json({ error: 'Invalid preview ID' });

    try {
      // Need to get the file SHA first
      var getResp = await gh('_previews/' + id + '.json?ref=' + branch);
      if (getResp.status !== 200) return res.status(404).json({ error: 'Preview not found' });
      var fileData = await getResp.json();

      var delResp = await gh('_previews/' + id + '.json', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Delete preview: ' + id,
          sha: fileData.sha,
          branch: branch
        })
      });

      if (delResp.status !== 200) {
        var errData = await delResp.json();
        return res.status(500).json({ error: 'Failed to delete: ' + (errData.message || delResp.status) });
      }

      return res.status(200).json({ success: true, id: id });
    } catch(err) {
      return res.status(500).json({ error: 'Failed to delete preview: ' + err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
