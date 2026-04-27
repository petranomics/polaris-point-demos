// /api/beacons/oauth/debug.js — Privacy-safe env var fingerprints for
// diagnosing OAuth setup issues. Returns length + first/last few chars of
// each value so the user can verify what's actually configured without
// exposing the full secrets.
//
// GET (with x-beacons-auth header) → JSON fingerprints

const G = require('../../../lib/google');

function fingerprint(s) {
  if (!s) return null;
  return {
    length: s.length,
    head: s.slice(0, 14),
    tail: s.slice(-15)
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-beacons-auth');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  if (!process.env.BEACONS_PASSCODE_HASH) {
    return res.status(500).json({ error: 'BEACONS_PASSCODE_HASH not set on the server' });
  }
  if (!G.checkBeaconsAuth(req)) return res.status(401).json({ error: 'Invalid auth' });

  return res.status(200).json({
    note: 'Fingerprints only — head/tail of each value, never the full secret',
    runtime: {
      now: new Date().toISOString()
    },
    GOOGLE_CLIENT_ID: fingerprint(process.env.GOOGLE_CLIENT_ID),
    GOOGLE_CLIENT_SECRET: fingerprint(process.env.GOOGLE_CLIENT_SECRET),
    GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || null,
    BEACONS_PASSCODE_HASH: fingerprint(process.env.BEACONS_PASSCODE_HASH),
    DATABASE_URL_set: !!process.env.DATABASE_URL,
    ANTHROPIC_API_KEY_set: !!process.env.ANTHROPIC_API_KEY,
    expected_redirect_uri: 'https://polarispoint.io/api/beacons/oauth/callback',
    redirect_uri_matches_expected: (process.env.GOOGLE_REDIRECT_URI || 'https://polarispoint.io/api/beacons/oauth/callback') === 'https://polarispoint.io/api/beacons/oauth/callback'
  });
};
