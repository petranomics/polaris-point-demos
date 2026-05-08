// /api/beacons/auth/change-password.js
//
// POST { current_password, new_password } → { ok: true }
// Authenticated via JWT (x-beacons-auth). Pete's legacy passcode tenant can't
// change-password through this endpoint (no real password stored) — Pete
// rotates his passcode by editing BEACONS_PASSCODE_HASH in Vercel.

const { neon } = require('@neondatabase/serverless');
const Auth = require('../../../lib/auth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-beacons-auth');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  if (!process.env.DATABASE_URL)       return res.status(500).json({ error: 'DATABASE_URL not configured' });
  if (!process.env.BEACONS_JWT_SECRET) return res.status(500).json({ error: 'BEACONS_JWT_SECRET not configured' });

  const tenant = await Auth.resolveTenant(req);
  if (!tenant) return res.status(401).json({ error: 'Not authenticated' });

  if (tenant.id === 'pete') {
    return res.status(400).json({ error: "Pete's account uses the legacy passcode. Change BEACONS_PASSCODE_HASH in Vercel env." });
  }

  const { current_password, new_password } = req.body || {};
  if (!current_password || !new_password) return res.status(400).json({ error: 'Missing current_password or new_password' });
  if (new_password.length < 8) return res.status(400).json({ error: 'New password must be 8+ characters' });

  const ok = await Auth.verifyPassword(current_password, tenant.password_hash);
  if (!ok) return res.status(401).json({ error: 'Current password incorrect' });

  const newHash = await Auth.hashPassword(new_password);
  const sql = neon(process.env.DATABASE_URL);
  await sql`
    UPDATE beacons_tenants
       SET password_hash = ${newHash}, updated_at = NOW()
     WHERE id = ${tenant.id}
  `;

  return res.status(200).json({ ok: true });
};
