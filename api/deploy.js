// /api/deploy.js — One-click site deployment: creates a new GitHub repo + Vercel project per client
// POST /api/deploy { slug, template, config, domain (optional) }
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  var ghToken = process.env.GITHUB_TOKEN;
  var vercelToken = process.env.VERCEL_TOKEN;
  if (!ghToken) return res.status(500).json({ error: 'GITHUB_TOKEN not configured' });
  if (!vercelToken) return res.status(500).json({ error: 'VERCEL_TOKEN not configured' });

  var body = req.body;
  if (!body || !body.slug || !body.template || !body.config) {
    return res.status(400).json({ error: 'Missing slug, template, or config' });
  }

  var slug = body.slug.toLowerCase().replace(/[^a-z0-9-]/g, '').substring(0, 30);
  if (!slug) return res.status(400).json({ error: 'Invalid slug' });

  var owner = 'petranomics';
  var sourceRepo = 'polaris-point-demos';
  var branch = 'main';
  var newRepoName = 'pp-' + slug;
  var template = body.template;
  var domain = body.domain ? body.domain.trim().toLowerCase() : null;

  var validTemplates = ['plumber', 'salon', 'restaurant', 'pest-control', 'cafe'];
  if (validTemplates.indexOf(template) === -1) {
    return res.status(400).json({ error: 'Invalid template: ' + template });
  }

  // GitHub API helper for the source repo (reading files)
  var ghSource = function(path) {
    return fetch('https://api.github.com/repos/' + owner + '/' + sourceRepo + '/contents/' + path + '?ref=' + branch, {
      headers: {
        'Authorization': 'Bearer ' + ghToken,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'PolarisPoint-Deploy'
      }
    });
  };

  // GitHub API helper for the new repo (writing files)
  var ghNew = function(path, options) {
    options = options || {};
    options.headers = Object.assign({
      'Authorization': 'Bearer ' + ghToken,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'PolarisPoint-Deploy'
    }, options.headers || {});
    return fetch('https://api.github.com/repos/' + owner + '/' + newRepoName + '/contents/' + path, options);
  };

  // GitHub API helper (generic)
  var ghApi = function(url, options) {
    options = options || {};
    options.headers = Object.assign({
      'Authorization': 'Bearer ' + ghToken,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'PolarisPoint-Deploy'
    }, options.headers || {});
    return fetch(url, options);
  };

  // Vercel API helper
  // Optional team scope. If VERCEL_TEAM_ID is set, append it to every API
  // call so team-scoped tokens land their projects in the right team.
  // Without this, a token created at the personal level can't create
  // projects under a team — Vercel returns "Not authorized".
  var vercelTeamId = process.env.VERCEL_TEAM_ID || '';
  var vercelApi = function(path, options) {
    options = options || {};
    options.headers = Object.assign({
      'Authorization': 'Bearer ' + vercelToken,
      'Content-Type': 'application/json'
    }, options.headers || {});
    var url = 'https://api.vercel.com' + path;
    if (vercelTeamId) {
      url += (path.indexOf('?') === -1 ? '?' : '&') + 'teamId=' + encodeURIComponent(vercelTeamId);
    }
    return fetch(url, options);
  };

  var createdRepo = false;

  try {
    // ── Step 1: Create new GitHub repo ──────────────────────────────────
    var createRepoResp = await ghApi('https://api.github.com/user/repos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newRepoName,
        description: 'Polaris Point demo site: ' + slug,
        private: false,
        auto_init: true
      })
    });

    if (createRepoResp.status === 422) {
      return res.status(409).json({ error: 'Repo "' + newRepoName + '" already exists' });
    }
    if (!createRepoResp.ok) {
      var errData = await createRepoResp.json().catch(function() { return {}; });
      return res.status(500).json({ error: 'Failed to create repo: ' + (errData.message || createRepoResp.status) });
    }

    createdRepo = true;

    // Brief pause to let GitHub initialize the repo with README
    await new Promise(function(resolve) { setTimeout(resolve, 2000); });

    // ── Step 2: Read all source files in parallel ───────────────────────

    // Shared files to copy
    var sharedFiles = [
      'shared/config-engine.js',
      'shared/features.js',
      'shared/features.css',
      'shared/schema-generator.js',
      'shared/site-admin.js',
      'shared/site-admin.css',
      'favicon.svg'
    ];

    // Template files to copy
    var templateFiles = ['index.html', 'styles.css'];

    // Check if template has a script.js
    var scriptCheck = await ghSource(template + '/script.js');
    if (scriptCheck.status === 200) templateFiles.push('script.js');

    // Read all source files in parallel
    var allSourceReads = [];
    var allSourcePaths = [];

    sharedFiles.forEach(function(f) {
      allSourcePaths.push({ source: f, dest: f }); // shared/ files keep their path
      allSourceReads.push(ghSource(f));
    });

    templateFiles.forEach(function(f) {
      allSourcePaths.push({ source: template + '/' + f, dest: f }); // template files go to root
      allSourceReads.push(ghSource(template + '/' + f));
    });

    var sourceResponses = await Promise.all(allSourceReads);
    var sourceDataPromises = sourceResponses.map(function(r, i) {
      if (r.status !== 200) return null;
      return r.json();
    });
    var sourceData = await Promise.all(sourceDataPromises);

    // ── Step 3: Prepare all files to write ──────────────────────────────
    var filesToWrite = [];

    for (var i = 0; i < allSourcePaths.length; i++) {
      if (!sourceData[i]) continue;
      var destPath = allSourcePaths[i].dest;
      var content = sourceData[i].content; // base64 from GitHub

      // For template index.html, fix paths (remove template prefix)
      if (destPath === 'index.html') {
        var decoded = Buffer.from(content, 'base64').toString('utf8');
        // Replace /{template}/config.js → /config.js etc.
        decoded = decoded.replace(new RegExp('/' + template + '/config\\.js', 'g'), '/config.js');
        decoded = decoded.replace(new RegExp('/' + template + '/styles\\.css', 'g'), '/styles.css');
        decoded = decoded.replace(new RegExp('/' + template + '/script\\.js', 'g'), '/script.js');
        content = Buffer.from(decoded).toString('base64');
      }

      filesToWrite.push({ path: destPath, content: content });
    }

    // config.js
    filesToWrite.push({
      path: 'config.js',
      content: Buffer.from(body.config).toString('base64')
    });

    // admin/index.html
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
      '  <script src="/config.js"></script>\n' +
      '  <div id="adminRoot"></div>\n' +
      '  <script src="/shared/site-admin.js"></script>\n' +
      '</body>\n</html>';

    filesToWrite.push({
      path: 'admin/index.html',
      content: Buffer.from(adminHtml).toString('base64')
    });

    // vercel.json
    var vercelJson = JSON.stringify({
      cleanUrls: true,
      trailingSlash: false
    }, null, 2);

    filesToWrite.push({
      path: 'vercel.json',
      content: Buffer.from(vercelJson).toString('base64')
    });

    // ── Step 4: Write all files to the new repo ─────────────────────────
    // GitHub Contents API requires sequential commits (each needs the latest SHA).
    // To parallelize, we batch files that don't collide. But the simplest reliable
    // approach within the time budget: write them sequentially with a single commit
    // message pattern. We can parallelize the first batch since the repo only has
    // the auto-init README.

    // Write first file to establish the branch
    var firstFile = filesToWrite.shift();
    var firstResp = await ghNew(firstFile.path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Deploy ' + slug + ': initial files',
        content: firstFile.content,
        branch: branch
      })
    });

    if (!firstResp.ok) {
      var firstErr = await firstResp.json().catch(function() { return {}; });
      throw new Error('Failed to write ' + firstFile.path + ': ' + (firstErr.message || firstResp.status));
    }

    // Write remaining files — must be sequential since each commit updates the branch tip
    var createdFiles = [firstFile.path];
    for (var j = 0; j < filesToWrite.length; j++) {
      var file = filesToWrite[j];
      var writeResp = await ghNew(file.path, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Deploy ' + slug + ': add ' + file.path,
          content: file.content,
          branch: branch
        })
      });
      if (writeResp.ok) {
        createdFiles.push(file.path);
      } else {
        var writeErr = await writeResp.json().catch(function() { return {}; });
        console.error('Failed to write ' + file.path + ':', writeErr.message || writeResp.status);
      }
    }

    // ── Step 5: Create Vercel project linked to the new repo ────────────
    var vercelResp = await vercelApi('/v10/projects', {
      method: 'POST',
      body: JSON.stringify({
        name: newRepoName,
        framework: null,
        gitRepository: {
          type: 'github',
          repo: owner + '/' + newRepoName
        }
      })
    });

    var vercelData = await vercelResp.json().catch(function() { return {}; });
    var vercelProjectId = vercelData.id || null;

    // FAIL FAST if Vercel project creation didn't succeed. Previous behaviour
    // was to swallow the error and continue, which left orphan GitHub repos
    // and DB rows pointing at 404 URLs. Now: roll back the GitHub repo we
    // just created (best-effort) and return Vercel's actual error to the
    // frontend so the user can diagnose (name conflict, quota, auth, etc.).
    if (!vercelResp.ok || !vercelProjectId) {
      console.error('Vercel project creation failed:', vercelResp.status, vercelData);
      var vercelErr = (vercelData && vercelData.error && vercelData.error.message)
        || (vercelData && vercelData.message)
        || ('Vercel returned HTTP ' + vercelResp.status);
      // Best-effort GitHub cleanup so we don't leave an orphan repo.
      try {
        await ghApi('https://api.github.com/repos/' + owner + '/' + newRepoName, { method: 'DELETE' });
      } catch (cleanupErr) {
        console.error('GitHub cleanup after Vercel fail failed:', cleanupErr.message);
      }
      return res.status(502).json({
        error: 'Vercel project creation failed: ' + vercelErr,
        detail: vercelData,
        cleanup: 'GitHub repo deletion attempted'
      });
    }

    // Disable Vercel authentication so the site is publicly accessible
    await vercelApi('/v9/projects/' + vercelProjectId, {
      method: 'PATCH',
      body: JSON.stringify({ ssoProtection: null, passwordProtection: null })
    }).catch(function() {});

    // ── Step 6: Trigger first deployment ──────────────────────────────
    if (vercelProjectId) {
      try {
        await vercelApi('/v13/deployments', {
          method: 'POST',
          body: JSON.stringify({
            name: newRepoName,
            project: vercelProjectId,
            gitSource: {
              type: 'github',
              org: owner,
              repo: newRepoName,
              ref: branch
            },
            target: 'production'
          })
        });
      } catch(e) {
        console.error('Deploy trigger warning:', e.message);
      }
    }

    // ── Step 7: Add custom domain if provided ───────────────────────────
    var customDomain = null;
    if (domain && vercelProjectId) {
      var domainResp = await vercelApi('/v10/projects/' + vercelProjectId + '/domains', {
        method: 'POST',
        body: JSON.stringify({ name: domain })
      });
      if (domainResp.ok) {
        customDomain = domain;
      } else {
        var domainErr = await domainResp.json().catch(function() { return {}; });
        console.error('Domain add warning:', domainErr.error || domainErr);
      }
    }

    // ── Response ────────────────────────────────────────────────────────
    var siteUrl = 'https://' + newRepoName + '.vercel.app';
    var repoUrl = 'https://github.com/' + owner + '/' + newRepoName;

    return res.status(200).json({
      success: true,
      slug: slug,
      repoUrl: repoUrl,
      siteUrl: customDomain ? 'https://' + customDomain : siteUrl,
      vercelUrl: siteUrl,
      adminUrl: (customDomain ? 'https://' + customDomain : siteUrl) + '/admin',
      customDomain: customDomain,
      files: createdFiles,
      message: 'Site deployed! It may take 30-60 seconds for Vercel to build.'
    });

  } catch (err) {
    // Cleanup: try to delete the repo if it was created but something failed
    if (createdRepo) {
      try {
        await ghApi('https://api.github.com/repos/' + owner + '/' + newRepoName, {
          method: 'DELETE'
        });
      } catch (cleanupErr) {
        console.error('Cleanup failed — orphaned repo:', newRepoName);
      }
    }
    return res.status(500).json({ error: 'Deploy failed: ' + err.message });
  }
};
