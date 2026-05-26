// /api/destroy-site.js — Full teardown of a deployed client site.
//
// POST { slug }
// Headers: x-pp-user, x-pp-pw-hash  (senior admin's username + sha256 of pw)
//
// Deletes — in this order, reporting per-step results:
//   1. GitHub repo  (petranomics/pp-<slug>)     via GITHUB_TOKEN
//   2. Vercel project (pp-<slug>)               via VERCEL_TOKEN
//   3. sites table row                          via DATABASE_URL
//
// Safety:
//   - Senior role required (verified against the users table)
//   - Slug must exist in the sites table (no arbitrary destruction)
//   - One-step delete — each substep failure is reported but doesn't abort
//     subsequent steps (so partial cleanup doesn't leave the whole thing
//     wedged; orphans can be handled in the GitHub/Vercel UI as a follow-up).
//
// Caller responsibility:
//   - Confirm the user actually wants this (the admin UI prompts to type the
//     slug + re-enter password before invoking).
//   - Rotate any plaintext passwords already handed to the client.

const { neon } = require('@neondatabase/serverless');

const GH_OWNER = 'petranomics';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-pp-user, x-pp-pw-hash');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  if (!process.env.DATABASE_URL) return res.status(500).json({ error: 'DATABASE_URL not configured' });

  var body = req.body || {};
  var slug = (body.slug || '').toString().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 30);
  if (!slug) return res.status(400).json({ error: 'slug required' });

  var username = (req.headers['x-pp-user'] || '').toString().toLowerCase();
  var pwHash = (req.headers['x-pp-pw-hash'] || '').toString();
  if (!username || !pwHash) return res.status(401).json({ error: 'auth headers required' });

  var sql = neon(process.env.DATABASE_URL);

  // ── Step 0: verify senior user ───────────────────────────────────────────
  // LOWER() on both sides, and match against username / email / full_name
  // so a session that holds a short-form identifier ("pete" instead of
  // "peter@polarispoint.io") still resolves to the right user row.
  try {
    var users = await sql`
      SELECT username, password_hash, role FROM users
      WHERE LOWER(username)  = LOWER(${username})
         OR LOWER(email)     = LOWER(${username})
         OR LOWER(full_name) = LOWER(${username})
      LIMIT 1
    `;
    if (!users.length) return res.status(403).json({ error: 'unknown user (session: ' + username + ')' });
    if (users[0].password_hash !== pwHash) return res.status(403).json({ error: 'bad password' });
    if (users[0].role !== 'senior') return res.status(403).json({ error: 'senior role required' });
  } catch (err) {
    return res.status(500).json({ error: 'auth check failed: ' + err.message });
  }

  // ── Step 0.5: confirm the site actually exists in the registry ──────────
  var site;
  try {
    var rows = await sql`SELECT id, slug, vercel_url, repo_url FROM sites WHERE slug = ${slug} LIMIT 1`;
    if (!rows.length) return res.status(404).json({ error: 'site not registered: ' + slug });
    site = rows[0];
  } catch (err) {
    return res.status(500).json({ error: 'lookup failed: ' + err.message });
  }

  var repoName = 'pp-' + slug;
  var results = { github: 'skipped', vercel: 'skipped', db: 'skipped' };

  // ── Step 1: delete GitHub repo ──────────────────────────────────────────
  if (process.env.GITHUB_TOKEN) {
    try {
      var ghResp = await fetch('https://api.github.com/repos/' + GH_OWNER + '/' + repoName, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer ' + process.env.GITHUB_TOKEN,
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'polaris-point-admin'
        }
      });
      if (ghResp.status === 204) results.github = 'deleted';
      else if (ghResp.status === 404) results.github = 'not found (already gone)';
      else {
        var ghText = await ghResp.text();
        results.github = 'error ' + ghResp.status + ': ' + ghText.slice(0, 120);
      }
    } catch (e) {
      results.github = 'exception: ' + (e.message || 'unknown');
    }
  } else {
    results.github = 'skipped: no GITHUB_TOKEN';
  }

  // ── Step 2: delete Vercel project ───────────────────────────────────────
  // Team scope mirrors deploy.js: if VERCEL_TEAM_ID is set, scope the call
  // to the team so we hit the right project namespace.
  if (process.env.VERCEL_TOKEN) {
    try {
      var vTeam = process.env.VERCEL_TEAM_ID || '';
      var vUrl = 'https://api.vercel.com/v9/projects/' + repoName + (vTeam ? '?teamId=' + encodeURIComponent(vTeam) : '');
      var vResp = await fetch(vUrl, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + process.env.VERCEL_TOKEN }
      });
      if (vResp.status === 204) results.vercel = 'deleted';
      else if (vResp.status === 404) results.vercel = 'not found (already gone)';
      else {
        var vText = await vResp.text();
        results.vercel = 'error ' + vResp.status + ': ' + vText.slice(0, 120);
      }
    } catch (e) {
      results.vercel = 'exception: ' + (e.message || 'unknown');
    }
  } else {
    results.vercel = 'skipped: no VERCEL_TOKEN';
  }

  // ── Step 3: delete the sites table row ──────────────────────────────────
  try {
    await sql`DELETE FROM sites WHERE id = ${site.id}`;
    results.db = 'deleted';
  } catch (e) {
    results.db = 'exception: ' + (e.message || 'unknown');
  }

  return res.status(200).json({
    success: true,
    slug: slug,
    repoName: repoName,
    results: results
  });
};
