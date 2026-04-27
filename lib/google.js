// /lib/google.js — Google OAuth helpers shared by /api/beacons/oauth/* and
// future Drive/Gmail/Docs/Sheets/Slides handlers. Single-user model: one
// row in beacons_oauth keyed by provider='google'.

const { neon } = require('@neondatabase/serverless');

function sql() {
  return neon(process.env.DATABASE_URL);
}

async function ensureSchema() {
  const s = sql();
  await s`
    CREATE TABLE IF NOT EXISTS beacons_oauth (
      provider TEXT PRIMARY KEY,
      email TEXT,
      access_token TEXT,
      refresh_token TEXT,
      token_expires_at TIMESTAMPTZ,
      scopes TEXT[],
      connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await s`
    CREATE TABLE IF NOT EXISTS beacons_oauth_state (
      state TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/presentations'
];

function redirectUri() {
  return process.env.GOOGLE_REDIRECT_URI || 'https://polarispoint.io/api/beacons/oauth/callback';
}

function clientId() { return (process.env.GOOGLE_CLIENT_ID || '').trim(); }
function clientSecret() { return (process.env.GOOGLE_CLIENT_SECRET || '').trim(); }

function buildAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    access_type: 'offline',
    include_granted_scopes: 'true',
    // 'select_account consent' forces Google to show the account picker every
    // time, regardless of what's already signed in to the browser. Pete's
    // dedicated Beacons account vs. work account, so this matters.
    prompt: 'select_account consent',
    state: state || ''
  });
  return 'https://accounts.google.com/o/oauth2/v2/auth?' + params.toString();
}

async function saveState(state) {
  const s = sql();
  // GC any state rows older than 15 min before inserting
  await s`DELETE FROM beacons_oauth_state WHERE created_at < NOW() - INTERVAL '15 minutes'`;
  await s`INSERT INTO beacons_oauth_state (state) VALUES (${state}) ON CONFLICT DO NOTHING`;
}

async function consumeState(state) {
  if (!state) return false;
  const s = sql();
  const rows = await s`
    DELETE FROM beacons_oauth_state
    WHERE state = ${state} AND created_at > NOW() - INTERVAL '15 minutes'
    RETURNING state
  `;
  return rows.length > 0;
}

async function exchangeCode(code) {
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId(),
      client_secret: clientSecret(),
      redirect_uri: redirectUri(),
      grant_type: 'authorization_code'
    })
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error('Google token exchange failed: ' + resp.status + ' ' + text.slice(0, 300));
  }
  return resp.json();
}

async function refreshAccessToken(refreshToken) {
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId(),
      client_secret: clientSecret(),
      grant_type: 'refresh_token'
    })
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error('Google token refresh failed: ' + resp.status + ' ' + text.slice(0, 300));
  }
  return resp.json();
}

async function fetchUserinfo(accessToken) {
  const resp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: 'Bearer ' + accessToken }
  });
  if (!resp.ok) throw new Error('userinfo failed: ' + resp.status);
  return resp.json();
}

async function getGoogleAccount() {
  const s = sql();
  const rows = await s`
    SELECT email, access_token, refresh_token, token_expires_at, scopes, connected_at, updated_at
    FROM beacons_oauth
    WHERE provider = 'google'
    LIMIT 1
  `;
  return rows[0] || null;
}

async function saveGoogleAccount({ email, accessToken, refreshToken, expiresAt, scopes }) {
  const s = sql();
  await s`
    INSERT INTO beacons_oauth (provider, email, access_token, refresh_token, token_expires_at, scopes, updated_at)
    VALUES ('google', ${email}, ${accessToken}, ${refreshToken || null}, ${expiresAt}, ${scopes}, NOW())
    ON CONFLICT (provider) DO UPDATE SET
      email = EXCLUDED.email,
      access_token = EXCLUDED.access_token,
      refresh_token = COALESCE(EXCLUDED.refresh_token, beacons_oauth.refresh_token),
      token_expires_at = EXCLUDED.token_expires_at,
      scopes = EXCLUDED.scopes,
      updated_at = NOW()
  `;
}

async function deleteGoogleAccount() {
  const s = sql();
  await s`DELETE FROM beacons_oauth WHERE provider = 'google'`;
}

async function revokeAtGoogle(token) {
  // Best-effort revoke; don't throw on failure.
  try {
    await fetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(token), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
  } catch (e) { /* ignore */ }
}

// Returns a current access token, refreshing if expired or expiring soon.
// Returns null if no account is connected.
async function getValidAccessToken() {
  const acct = await getGoogleAccount();
  if (!acct) return null;
  const now = Date.now();
  const expires = acct.token_expires_at ? new Date(acct.token_expires_at).getTime() : 0;
  if (expires - now > 60_000 && acct.access_token) return acct.access_token;
  if (!acct.refresh_token) return null;

  const fresh = await refreshAccessToken(acct.refresh_token);
  const newExpires = new Date(now + (fresh.expires_in * 1000));
  await saveGoogleAccount({
    email: acct.email,
    accessToken: fresh.access_token,
    refreshToken: acct.refresh_token,
    expiresAt: newExpires.toISOString(),
    scopes: acct.scopes
  });
  return fresh.access_token;
}

function checkBeaconsAuth(req) {
  const expected = process.env.BEACONS_PASSCODE_HASH;
  if (!expected) return false;
  const got = (req.headers['x-beacons-auth'] || '').toString();
  if (got.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < got.length; i++) mismatch |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  return mismatch === 0;
}

function checkConfig() {
  const missing = [];
  if (!process.env.DATABASE_URL) missing.push('DATABASE_URL');
  if (!process.env.BEACONS_PASSCODE_HASH) missing.push('BEACONS_PASSCODE_HASH');
  if (!process.env.GOOGLE_CLIENT_ID) missing.push('GOOGLE_CLIENT_ID');
  if (!process.env.GOOGLE_CLIENT_SECRET) missing.push('GOOGLE_CLIENT_SECRET');
  return missing;
}

function genState() {
  // 32 bytes of randomness, hex-encoded
  const arr = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < 32; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

module.exports = {
  ensureSchema,
  GOOGLE_SCOPES,
  buildAuthUrl,
  saveState,
  consumeState,
  exchangeCode,
  refreshAccessToken,
  fetchUserinfo,
  getGoogleAccount,
  saveGoogleAccount,
  deleteGoogleAccount,
  revokeAtGoogle,
  getValidAccessToken,
  checkBeaconsAuth,
  checkConfig,
  genState
};
