// /api/beacons/oauth/callback.js — Google redirects here after consent.
// GET ?code=...&state=... → exchange code for tokens, store them, redirect
// the browser back to /beacons with a success/error flag.

const G = require('../../../lib/google');

function htmlRedirect(url, message) {
  // Plain HTML so we don't depend on any framework. Browser is brought back
  // to /beacons with a message in the hash for the client to read.
  return `<!doctype html><html><head><meta charset="utf-8"><title>Beacons · Connecting</title>
<meta http-equiv="refresh" content="0; url=${url}">
<style>body{background:#050D1E;color:#9BB0D4;font-family:-apple-system,Inter,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}div{text-align:center}</style>
</head><body><div>${message}<br><small>Redirecting…</small></div></body></html>`;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const missing = G.checkConfig();
  if (missing.length) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(500).send(htmlRedirect('/beacons#oauth-error=missing-config', 'Missing env vars: ' + missing.join(', ')));
  }

  const { code, state, error } = req.query || {};

  // Did the user deny consent or hit some Google error?
  if (error) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(htmlRedirect('/beacons#oauth-error=' + encodeURIComponent(error), 'Google said: ' + error));
  }

  if (!code) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(400).send(htmlRedirect('/beacons#oauth-error=missing-code', 'Missing code'));
  }

  try {
    await G.ensureSchema();
    // Best-effort state validation; if state isn't found (already consumed,
    // expired, or never created via /start), still proceed but flag it.
    let stateOk = false;
    try { stateOk = await G.consumeState(state); } catch (e) { /* ignore */ }

    const tokens = await G.exchangeCode(code);
    // tokens: { access_token, expires_in, refresh_token?, scope, token_type, id_token? }
    const ui = await G.fetchUserinfo(tokens.access_token);
    const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000)).toISOString();
    const scopes = (tokens.scope || '').split(' ').filter(Boolean);
    await G.saveGoogleAccount({
      email: ui.email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || null,
      expiresAt,
      scopes
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    const flag = stateOk ? 'oauth-connected' : 'oauth-connected-stateless';
    return res.status(200).send(htmlRedirect(
      '/beacons#' + flag + '=' + encodeURIComponent(ui.email || ''),
      'Connected ' + (ui.email || 'Google account') + '.'
    ));
  } catch (err) {
    console.error('oauth/callback error', err);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    // Render the full error inline so we can actually read it.
    const msg = err.message || 'Unknown error';
    return res.status(500).send(`<!doctype html><html><head><meta charset="utf-8"><title>Beacons · OAuth error</title>
<style>
body{background:#050D1E;color:#9BB0D4;font-family:-apple-system,Inter,sans-serif;padding:48px 24px;margin:0;min-height:100vh;box-sizing:border-box}
.card{max-width:760px;margin:0 auto;background:#0E1A38;border:1px solid rgba(91,141,239,.32);border-radius:14px;padding:28px;}
h1{color:#fff;font-family:'Space Grotesk',sans-serif;font-size:1.4rem;margin:0 0 16px}
pre{background:#050D1E;border:1px solid rgba(91,141,239,.15);border-radius:8px;padding:14px;overflow-x:auto;color:#9BB0D4;font-size:.82rem;line-height:1.55;white-space:pre-wrap;word-break:break-word}
.foot{margin-top:24px;font-size:.85rem;color:#6B82A8}
a{color:#5B8DEF}
ul{padding-left:20px;line-height:1.7}
strong{color:#fff}
</style></head><body><div class="card">
<h1>OAuth callback failed</h1>
<p style="margin-top:0">Google rejected the token exchange. The full error is below — paste it back to me to diagnose.</p>
<pre>${msg.replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]))}</pre>
<div class="foot">
<strong>Most common causes for "invalid_client" at this stage:</strong>
<ul>
<li>The Client Secret in Vercel was copied from a different OAuth client than the Client ID.</li>
<li>You regenerated/replaced the OAuth client in Google Cloud after pasting the secret — the old secret is now invalid.</li>
<li>The Client Secret has whitespace or got truncated (now auto-trimmed by the server).</li>
</ul>
<a href="/beacons">← Back to Beacons</a>
</div>
</div></body></html>`);
  }
};
