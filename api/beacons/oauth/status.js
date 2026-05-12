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

  // checkBeaconsAuth accepts both JWT (new) and legacy passcode hash, so the
  // earlier "if no BEACONS_PASSCODE_HASH, misconfigured" short-circuit is
  // removed — the unified auth covers both. checkConfig already reports
  // missing auth env vars if neither is set.
  if (!G.checkBeaconsAuth(req)) return res.status(401).json({ error: 'Invalid auth' });

  if (!configured) {
    return res.status(200).json({ connected: false, configured: false, missing });
  }

  try {
    await G.ensureSchema();
    const acct = await G.getGoogleAccount();
    if (!acct) return res.status(200).json({ connected: false, configured: true });

    // Look up sync state for any service rows that exist
    let gmailLastSync = null;
    let gmailThreadCount = null;
    let driveLastSync = null;
    let driveFileCount = null;
    try {
      const { neon } = require('@neondatabase/serverless');
      const sql = neon(process.env.DATABASE_URL);
      const rows = await sql`
        SELECT service, last_sync_at, thread_count FROM beacons_sync_state
      `;
      rows.forEach(r => {
        if (r.service === 'gmail') {
          gmailLastSync = r.last_sync_at;
          gmailThreadCount = r.thread_count;
        } else if (r.service === 'drive') {
          driveLastSync = r.last_sync_at;
          driveFileCount = r.thread_count;
        }
      });
    } catch (e) { /* table not created yet, fine */ }

    return res.status(200).json({
      connected: true,
      configured: true,
      email: acct.email,
      scopes: acct.scopes || [],
      connectedAt: acct.connected_at,
      updatedAt: acct.updated_at,
      gmailLastSync,
      gmailThreadCount,
      driveLastSync,
      driveFileCount
    });
  } catch (err) {
    console.error('oauth/status error', err);
    return res.status(500).json({ error: err.message || 'status failed' });
  }
};
