// /api/deploy.js — One-click site deployment via GitHub API
// POST /api/deploy { slug, template, config }
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  var token = process.env.GITHUB_TOKEN;
  if (!token) return res.status(500).json({ error: 'GITHUB_TOKEN not configured' });

  var body = req.body;
  if (!body || !body.slug || !body.template || !body.config) {
    return res.status(400).json({ error: 'Missing slug, template, or config' });
  }

  var slug = body.slug.toLowerCase().replace(/[^a-z0-9-]/g, '').substring(0, 30);
  if (!slug) return res.status(400).json({ error: 'Invalid slug' });

  var owner = 'petranomics';
  var repo = 'polaris-point-demos';
  var branch = 'main';
  var template = body.template; // plumber, salon, restaurant, pest-control
  var validTemplates = ['plumber', 'salon', 'restaurant', 'pest-control'];
  if (validTemplates.indexOf(template) === -1) {
    return res.status(400).json({ error: 'Invalid template: ' + template });
  }

  var gh = function(path, options) {
    options = options || {};
    options.headers = Object.assign({
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'PolarisPoint-Deploy'
    }, options.headers || {});
    return fetch('https://api.github.com/repos/' + owner + '/' + repo + '/contents/' + path, options);
  };

  try {
    // Check if slug folder already exists
    var checkResp = await gh(slug);
    if (checkResp.status === 200) {
      return res.status(409).json({ error: 'Site "' + slug + '" already exists' });
    }

    // Determine which template files to copy
    var filesToCopy = ['index.html', 'styles.css'];
    // Check if template has a script.js
    var scriptCheck = await gh(template + '/script.js');
    if (scriptCheck.status === 200) filesToCopy.push('script.js');

    var createdFiles = [];

    // Copy each template file
    for (var i = 0; i < filesToCopy.length; i++) {
      var fileName = filesToCopy[i];
      // Read from template
      var readResp = await gh(template + '/' + fileName + '?ref=' + branch);
      if (readResp.status !== 200) continue;
      var readData = await readResp.json();

      // Create in new folder
      var createResp = await gh(slug + '/' + fileName, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Deploy ' + slug + ': add ' + fileName,
          content: readData.content, // already base64
          branch: branch
        })
      });
      if (createResp.status === 201) createdFiles.push(fileName);
    }

    // Write config.js
    var configB64 = Buffer.from(body.config).toString('base64');
    await gh(slug + '/config.js', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Deploy ' + slug + ': add config.js',
        content: configB64,
        branch: branch
      })
    });
    createdFiles.push('config.js');

    // Create admin/index.html
    var adminHtml = '<!doctype html>\n<html lang="en">\n<head>\n' +
      '  <meta charset="UTF-8">\n' +
      '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
      '  <title>Site Admin</title>\n' +
      '  <link rel="icon" type="image/svg+xml" href="/favicon.svg">\n' +
      '  <link rel="preconnect" href="https://fonts.googleapis.com">\n' +
      '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
      '  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">\n' +
      '  <link rel="stylesheet" href="/shared/site-admin.css">\n' +
      '</head>\n<body>\n' +
      '  <script>window.PP_DEMO = ' + JSON.stringify(slug) + ';</script>\n' +
      '  <script src="/' + slug + '/config.js"></script>\n' +
      '  <div id="adminRoot"></div>\n' +
      '  <script src="/shared/site-admin.js"></script>\n' +
      '</body>\n</html>';

    var adminB64 = Buffer.from(adminHtml).toString('base64');
    await gh(slug + '/admin/index.html', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Deploy ' + slug + ': add admin',
        content: adminB64,
        branch: branch
      })
    });
    createdFiles.push('admin/index.html');

    var siteUrl = 'https://polarispoint.io/' + slug;
    var adminUrl = siteUrl + '/admin';

    return res.status(200).json({
      success: true,
      slug: slug,
      url: siteUrl,
      adminUrl: adminUrl,
      files: createdFiles,
      message: 'Site deployed! It may take 30-60 seconds for Vercel to build.'
    });

  } catch (err) {
    return res.status(500).json({ error: 'Deploy failed: ' + err.message });
  }
};
