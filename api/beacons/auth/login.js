// /api/beacons/auth/login.js — Email + password → JWT.
//
// POST { email, password } → { token, tenant }
// Token is a JWT good for JWT_TTL_DAYS. Client stores in localStorage and
// sends as `x-beacons-auth: <token>` on every subsequent request.

const { neon } = require('@neondatabase/serverless');
const Auth = require('../../../lib/auth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-beacons-auth');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  if (!process.env.DATABASE_URL)        return res.status(500).json({ error: 'DATABASE_URL not configured' });
  if (!process.env.BEACONS_JWT_SECRET)  return res.status(500).json({ error: 'BEACONS_JWT_SECRET not configured' });

  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });

  // Constant-time-ish: always run bcrypt even on missing tenant to avoid
  // timing-leak of which emails exist. Cheap insurance.
  const sql = neon(process.env.DATABASE_URL);
  await Auth.ensureTenantsTable(sql);

  const tenant = await Auth.findTenantByEmail(sql, email);
  const ok = tenant
    ? await Auth.verifyPassword(password, tenant.password_hash)
    : (await Auth.verifyPassword(password, '$2b$10$' + 'x'.repeat(53)), false);

  if (!tenant || !ok) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = Auth.signToken(tenant);
  return res.status(200).json({
    token,
    expires_in_days: Auth.JWT_TTL_DAYS,
    tenant: Auth.publicTenant(tenant)
  });
};
