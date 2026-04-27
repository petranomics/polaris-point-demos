// /api/beacons/oauth/disconnect.js — Revoke + clear the Google connection.
// POST → { ok: true }
// Auth: x-beacons-auth header.

const G = require('../../../lib/google');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-beacons-auth');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  if (!process.env.BEACONS_PASSCODE_HASH) return res.status(500).json({ error: 'BEACONS_PASSCODE_HASH not configured' });
  if (!G.checkBeaconsAuth(req)) return res.status(401).json({ error: 'Invalid auth' });

  try {
    await G.ensureSchema();
    const acct = await G.getGoogleAccount();
    if (acct) {
      // Best-effort revoke at Google. Errors here don't block local cleanup.
      if (acct.refresh_token) await G.revokeAtGoogle(acct.refresh_token);
      else if (acct.access_token) await G.revokeAtGoogle(acct.access_token);
      await G.deleteGoogleAccount();
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('oauth/disconnect error', err);
    return res.status(500).json({ error: err.message || 'disconnect failed' });
  }
};
