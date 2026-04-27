// /api/beacons/oauth/status.js — Returns the current Google connection state.
// GET → { connected, email?, scopes?, connectedAt?, configured }
// Auth: x-beacons-auth header.

const G = require('../../../lib/google');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-beacons-auth');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const missing = G.checkConfig();
  const configured = missing.length === 0;

  if (!process.env.BEACONS_PASSCODE_HASH) {
    return res.status(200).json({ connected: false, configured: false, missing });
  }
  if (!G.checkBeaconsAuth(req)) return res.status(401).json({ error: 'Invalid auth' });

  if (!configured) {
    return res.status(200).json({ connected: false, configured: false, missing });
  }

  try {
    await G.ensureSchema();
    const acct = await G.getGoogleAccount();
    if (!acct) return res.status(200).json({ connected: false, configured: true });
    return res.status(200).json({
      connected: true,
      configured: true,
      email: acct.email,
      scopes: acct.scopes || [],
      connectedAt: acct.connected_at,
      updatedAt: acct.updated_at
    });
  } catch (err) {
    console.error('oauth/status error', err);
    return res.status(500).json({ error: err.message || 'status failed' });
  }
};
