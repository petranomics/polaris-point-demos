// /api/beacons/auth/request-password-reset.js
//
// POST { email } → { ok: true } always (deliberately ambiguous to avoid
//                  leaking which emails are registered).
//
// Generates a one-shot token, stores it in beacons_password_resets with a
// 1-hour expiry, and emails the user a link to /beacon?reset=<token>. The
// reset-password endpoint validates the token and sets a new password.

const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');
const Auth = require('../../../lib/auth');
const Email = require('../../../lib/email');

const TOKEN_TTL_MIN = 60;

let _tableEnsured = false;
async function ensureResetTable(sql) {
  if (_tableEnsured) return;
  await sql`
    CREATE TABLE IF NOT EXISTS beacons_password_resets (
      token       TEXT PRIMARY KEY,
      tenant_id   TEXT NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at  TIMESTAMPTZ NOT NULL,
      used_at     TIMESTAMPTZ
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_pw_resets_tenant ON beacons_password_resets (tenant_id, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_pw_resets_expires ON beacons_password_resets (expires_at)`;
  _tableEnsured = true;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  if (!process.env.DATABASE_URL)        return res.status(500).json({ error: 'DATABASE_URL not configured' });
  if (!process.env.BEACONS_JWT_SECRET)  return res.status(500).json({ error: 'BEACONS_JWT_SECRET not configured' });

  const { email } = req.body || {};
  if (!email || typeof email !== 'string') {
    // Even on bad input, return the same opaque response so attackers can't
    // probe.
    return res.status(200).json({ ok: true });
  }

  const sql = neon(process.env.DATABASE_URL);
  await Auth.ensureTenantsTable(sql);
  await ensureResetTable(sql);

  const tenant = await Auth.findTenantByEmail(sql, email);
  if (!tenant) {
    // Don't reveal that the email isn't registered. Same response either way.
    return res.status(200).json({ ok: true });
  }
  if (tenant.id === 'pete') {
    // Pete still has the legacy passcode fallback; refuse reset to avoid
    // confusion since `change-password` already blocks his account.
    return res.status(200).json({ ok: true });
  }

  // Generate token, store, send email.
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MIN * 60 * 1000);
  await sql`
    INSERT INTO beacons_password_resets (token, tenant_id, expires_at)
    VALUES (${token}, ${tenant.id}, ${expiresAt.toISOString()})
  `;

  const resetUrl = `https://polarispoint.io/beacon?reset=${encodeURIComponent(token)}`;
  try {
    await Email.sendPasswordResetEmail({
      to: tenant.email,
      displayName: tenant.display_name,
      resetUrl,
      expiresInMinutes: TOKEN_TTL_MIN
    });
  } catch (e) {
    console.error('[request-password-reset] email send failed:', e.message);
    // Still return ok:true — the token is in DB and the admin can recover.
  }

  return res.status(200).json({ ok: true });
};
