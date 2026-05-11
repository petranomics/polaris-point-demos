// /api/beacons/auth/reset-password.js
//
// POST { token, new_password } → { ok, token (JWT), tenant }
//
// Validates the one-shot reset token: must exist, not be used, not be expired.
// On success: updates tenant.password_hash, marks token used, returns a fresh
// JWT so the client can sign the user in immediately.

const { neon } = require('@neondatabase/serverless');
const Auth = require('../../../lib/auth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  if (!process.env.DATABASE_URL)        return res.status(500).json({ error: 'DATABASE_URL not configured' });
  if (!process.env.BEACONS_JWT_SECRET)  return res.status(500).json({ error: 'BEACONS_JWT_SECRET not configured' });

  const { token, new_password } = req.body || {};
  if (!token || typeof token !== 'string') return res.status(400).json({ error: 'Missing token' });
  if (!new_password || typeof new_password !== 'string') return res.status(400).json({ error: 'Missing new_password' });
  if (new_password.length < 8) return res.status(400).json({ error: 'Password must be 8+ characters' });

  const sql = neon(process.env.DATABASE_URL);

  const rows = await sql`
    SELECT token, tenant_id, used_at, expires_at
      FROM beacons_password_resets
     WHERE token = ${token}
     LIMIT 1
  `;
  if (!rows.length) return res.status(400).json({ error: 'Invalid or expired reset link' });
  const r = rows[0];
  if (r.used_at) return res.status(400).json({ error: 'This reset link has already been used' });
  if (new Date(r.expires_at) < new Date()) return res.status(400).json({ error: 'This reset link has expired' });

  const tenant = await Auth.findTenantById(sql, r.tenant_id);
  if (!tenant) return res.status(400).json({ error: 'Account no longer exists' });

  const newHash = await Auth.hashPassword(new_password);

  // Update password + mark token used in the same logical step. Two queries
  // because Neon serverless doesn't support multi-statement in one call.
  await sql`UPDATE beacons_tenants SET password_hash = ${newHash}, updated_at = NOW() WHERE id = ${tenant.id}`;
  await sql`UPDATE beacons_password_resets SET used_at = NOW() WHERE token = ${token}`;

  const fresh = await Auth.findTenantById(sql, tenant.id);
  const jwt = Auth.signToken(fresh);
  return res.status(200).json({
    ok: true,
    token: jwt,
    expires_in_days: Auth.JWT_TTL_DAYS,
    tenant: Auth.publicTenant(fresh)
  });
};
