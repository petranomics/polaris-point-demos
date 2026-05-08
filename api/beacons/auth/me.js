// /api/beacons/auth/me.js — Resolve current tenant from auth header.
//
// GET → { tenant }
// Used by the frontend on load to determine if the stored token is still
// valid and to populate the settings UI.

const Auth = require('../../../lib/auth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-beacons-auth');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  if (!process.env.DATABASE_URL)        return res.status(500).json({ error: 'DATABASE_URL not configured' });
  if (!process.env.BEACONS_JWT_SECRET)  return res.status(500).json({ error: 'BEACONS_JWT_SECRET not configured' });

  const tenant = await Auth.resolveTenant(req);
  if (!tenant) return res.status(401).json({ error: 'Not authenticated' });
  return res.status(200).json({ tenant: Auth.publicTenant(tenant) });
};
