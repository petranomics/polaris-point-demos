// /api/vercel-debug.js — Senior-only Vercel auth diagnostic.
//
// Calls Vercel's /v2/user, /v2/teams, and /v9/projects with the configured
// VERCEL_TOKEN and returns the results so we can see (a) whether the token
// is valid, (b) what user/team it authenticates as, (c) what teams it has
// access to, and (d) where existing projects live.
//
// Use this when /api/deploy fails with 'Not authorized' to figure out
// whether VERCEL_TEAM_ID needs to be set, the token needs regenerating,
// or the scope is wrong.
//
// GET /api/vercel-debug
// Headers: x-pp-user, x-pp-pw-hash  (same auth pattern as destroy-site)
//
// SAFE TO REMOVE once we've finished diagnosing.

const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'x-pp-user, x-pp-pw-hash');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!process.env.DATABASE_URL) return res.status(500).json({ error: 'DATABASE_URL not configured' });

  // Senior auth gate — same as destroy-site, so the endpoint can't leak
  // your Vercel account info to anyone who finds the URL.
  var username = (req.headers['x-pp-user'] || '').toString().toLowerCase();
  var pwHash = (req.headers['x-pp-pw-hash'] || '').toString();
  if (!username || !pwHash) return res.status(401).json({ error: 'auth headers required' });

  var sql = neon(process.env.DATABASE_URL);
  try {
    var users = await sql`
      SELECT password_hash, role FROM users
      WHERE LOWER(username) = LOWER(${username})
         OR LOWER(email) = LOWER(${username})
         OR LOWER(full_name) = LOWER(${username})
      LIMIT 1
    `;
    if (!users.length) return res.status(403).json({ error: 'unknown user' });
    if (users[0].password_hash !== pwHash) return res.status(403).json({ error: 'bad password' });
    if (users[0].role !== 'senior') return res.status(403).json({ error: 'senior role required' });
  } catch (err) {
    return res.status(500).json({ error: 'auth check failed: ' + err.message });
  }

  var token = process.env.VERCEL_TOKEN;
  if (!token) return res.status(200).json({ error: 'VERCEL_TOKEN env var is not set on this project — that is the root cause.' });

  var configuredTeamId = process.env.VERCEL_TEAM_ID || null;

  var hitVercel = async function (path) {
    try {
      var r = await fetch('https://api.vercel.com' + path, {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      var data = await r.json().catch(function () { return {}; });
      return { status: r.status, ok: r.ok, data: data };
    } catch (e) {
      return { error: e.message };
    }
  };

  // /v2/user — who is this token, what type
  var userResult = await hitVercel('/v2/user');
  // /v2/teams — what teams does this token have access to
  var teamsResult = await hitVercel('/v2/teams');
  // /v9/projects — list a few existing projects + where they live
  var projectsResult = await hitVercel('/v9/projects?limit=5');
  // Same call but scoped to VERCEL_TEAM_ID if set, so we see whether the
  // team-scoped projects are accessible.
  var teamScopedProjects = null;
  if (configuredTeamId) {
    teamScopedProjects = await hitVercel('/v9/projects?limit=5&teamId=' + encodeURIComponent(configuredTeamId));
  }

  // Curate the response to surface the key info without dumping everything.
  return res.status(200).json({
    env: {
      VERCEL_TOKEN: token ? 'set (length ' + token.length + ')' : 'MISSING',
      VERCEL_TEAM_ID: configuredTeamId || 'not set'
    },
    user: {
      status: userResult.status,
      username: userResult.data && userResult.data.user && userResult.data.user.username,
      email: userResult.data && userResult.data.user && userResult.data.user.email,
      uid: userResult.data && userResult.data.user && userResult.data.user.uid,
      error: userResult.data && userResult.data.error
    },
    teams: {
      status: teamsResult.status,
      count: teamsResult.data && teamsResult.data.teams ? teamsResult.data.teams.length : 0,
      list: (teamsResult.data && teamsResult.data.teams || []).map(function (t) {
        return { id: t.id, slug: t.slug, name: t.name };
      }),
      error: teamsResult.data && teamsResult.data.error
    },
    projects_no_team_scope: {
      status: projectsResult.status,
      count: projectsResult.data && projectsResult.data.projects ? projectsResult.data.projects.length : 0,
      sample: (projectsResult.data && projectsResult.data.projects || []).slice(0, 5).map(function (p) {
        return { name: p.name, accountId: p.accountId };
      }),
      error: projectsResult.data && projectsResult.data.error
    },
    projects_team_scope: teamScopedProjects ? {
      status: teamScopedProjects.status,
      count: teamScopedProjects.data && teamScopedProjects.data.projects ? teamScopedProjects.data.projects.length : 0,
      sample: (teamScopedProjects.data && teamScopedProjects.data.projects || []).slice(0, 5).map(function (p) {
        return { name: p.name, accountId: p.accountId };
      }),
      error: teamScopedProjects.data && teamScopedProjects.data.error
    } : 'no VERCEL_TEAM_ID set; skipped'
  });
};
