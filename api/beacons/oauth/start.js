// /api/beacons/oauth/start.js — Begin a Google OAuth flow.
// POST → returns { url } pointing the browser at Google's consent screen.
// Auth: x-beacons-auth header (the workspace passcode hash).

const G = require('../../../lib/google');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-beacons-auth');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const missing = G.checkConfig();
  if (missing.length) return res.status(500).json({ error: 'Missing env vars: ' + missing.join(', ') });
  if (!G.checkBeaconsAuth(req)) return res.status(401).json({ error: 'Invalid auth' });

  try {
    await G.ensureSchema();
    const state = G.genState();
    await G.saveState(state);
    const url = G.buildAuthUrl(state);
    return res.status(200).json({ url, state });
  } catch (err) {
    console.error('oauth/start error', err);
    return res.status(500).json({ error: err.message || 'oauth start failed' });
  }
};
