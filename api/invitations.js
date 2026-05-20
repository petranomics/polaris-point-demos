// /api/invitations.js — email-invite flow for admin/ops users.
//
//   POST  /api/invitations                 create + email an invite (senior action)
//   GET   /api/invitations                 list invitations (for the Users tab)
//   GET   /api/invitations?token=XXX       validate a token (accept page)
//   POST  /api/invitations?action=accept   accept: token + name + password -> user
//   POST  /api/invitations?action=revoke   revoke a pending invite  (body: { id })
//   POST  /api/invitations?action=resend   re-send the email        (body: { id })
//
// Auth note: these endpoints are not session-gated server-side (the rest of
// this codebase gates in the client). The accept flow is safe because it
// requires a long random token; create/revoke/resend are surfaced only in the
// senior-only Users tab.
const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');
const { sendInviteEmail } = require('../lib/email');

const EXPIRES_DAYS = 7;

function baseUrl(req) {
  // Prefer the request host so invites work on preview + prod without config.
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'polarispoint.io';
  return `${proto}://${host}`;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = neon(process.env.DATABASE_URL);

  try {
    // ---- Validate a token (accept page calls this on load) ----
    if (req.method === 'GET' && req.query.token) {
      const rows = await sql`SELECT email, role, full_name, status, expires_at FROM invitations WHERE token = ${req.query.token}`;
      if (!rows.length) return res.status(404).json({ valid: false, reason: 'not_found' });
      const inv = rows[0];
      if (inv.status !== 'pending') return res.status(200).json({ valid: false, reason: inv.status });
      if (new Date(inv.expires_at) < new Date()) return res.status(200).json({ valid: false, reason: 'expired' });
      return res.status(200).json({ valid: true, email: inv.email, role: inv.role, full_name: inv.full_name });
    }

    // ---- List invitations (Users tab) ----
    if (req.method === 'GET') {
      const rows = await sql`
        SELECT id, email, role, full_name, invited_by, status, created_at, expires_at, accepted_at
        FROM invitations ORDER BY created_at DESC LIMIT 100`;
      return res.status(200).json({ invitations: rows });
    }

    // ---- Accept an invite: create the user, mark accepted ----
    if (req.method === 'POST' && req.query.action === 'accept') {
      const b = req.body || {};
      if (!b.token || !b.password_hash || !b.full_name) {
        return res.status(400).json({ error: 'Missing token, full_name, or password' });
      }
      const rows = await sql`SELECT * FROM invitations WHERE token = ${b.token}`;
      if (!rows.length) return res.status(404).json({ error: 'Invitation not found' });
      const inv = rows[0];
      if (inv.status !== 'pending') return res.status(409).json({ error: 'This invitation was already ' + inv.status });
      if (new Date(inv.expires_at) < new Date()) {
        await sql`UPDATE invitations SET status = 'expired' WHERE id = ${inv.id}`;
        return res.status(410).json({ error: 'This invitation has expired' });
      }
      const username = inv.email.toLowerCase();
      const existing = await sql`SELECT id FROM users WHERE username = ${username}`;
      if (existing.length) {
        // Account already exists — just consume the invite, don't duplicate.
        await sql`UPDATE invitations SET status = 'accepted', accepted_at = NOW() WHERE id = ${inv.id}`;
        return res.status(409).json({ error: 'An account already exists for this email. Try signing in.' });
      }
      const created = await sql`
        INSERT INTO users (username, password_hash, full_name, role, email)
        VALUES (${username}, ${b.password_hash}, ${b.full_name}, ${inv.role}, ${inv.email})
        RETURNING id, username, full_name, role, email`;
      await sql`UPDATE invitations SET status = 'accepted', accepted_at = NOW() WHERE id = ${inv.id}`;
      return res.status(201).json({ user: created[0] });
    }

    // ---- Revoke a pending invite ----
    if (req.method === 'POST' && req.query.action === 'revoke') {
      const id = (req.body || {}).id;
      if (!id) return res.status(400).json({ error: 'id required' });
      await sql`UPDATE invitations SET status = 'revoked' WHERE id = ${id} AND status = 'pending'`;
      return res.status(200).json({ ok: true });
    }

    // ---- Resend the invite email for a pending invite ----
    if (req.method === 'POST' && req.query.action === 'resend') {
      const id = (req.body || {}).id;
      if (!id) return res.status(400).json({ error: 'id required' });
      const rows = await sql`SELECT * FROM invitations WHERE id = ${id} AND status = 'pending'`;
      if (!rows.length) return res.status(404).json({ error: 'No pending invitation with that id' });
      const inv = rows[0];
      const acceptUrl = `${baseUrl(req)}/admin/accept?token=${inv.token}`;
      try {
        await sendInviteEmail({ to: inv.email, inviterName: inv.invited_by, role: inv.role, acceptUrl, expiresInDays: EXPIRES_DAYS });
      } catch (e) {
        return res.status(502).json({ error: 'Could not send email: ' + e.message });
      }
      return res.status(200).json({ ok: true });
    }

    // ---- Create a new invite (+ send email) ----
    if (req.method === 'POST') {
      const b = req.body || {};
      const email = (b.email || '').trim().toLowerCase();
      if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email required' });
      const role = b.role === 'senior' ? 'senior' : 'junior';

      // Already a user?
      const existingUser = await sql`SELECT id FROM users WHERE username = ${email}`;
      if (existingUser.length) return res.status(409).json({ error: 'A user with that email already exists' });

      // Supersede any prior pending invite for this email.
      await sql`UPDATE invitations SET status = 'revoked' WHERE email = ${email} AND status = 'pending'`;

      const token = crypto.randomBytes(24).toString('hex');
      const expires = new Date(Date.now() + EXPIRES_DAYS * 86400000).toISOString();
      const created = await sql`
        INSERT INTO invitations (email, role, full_name, token, invited_by, expires_at)
        VALUES (${email}, ${role}, ${b.full_name || null}, ${token}, ${b.invited_by || null}, ${expires})
        RETURNING id, email, role, full_name, status, created_at, expires_at`;

      const acceptUrl = `${baseUrl(req)}/admin/accept?token=${token}`;
      let emailed = true, emailError = null;
      try {
        await sendInviteEmail({ to: email, inviterName: b.invited_by, role, acceptUrl, expiresInDays: EXPIRES_DAYS });
      } catch (e) {
        // Don't fail the whole request — the invite row exists and the link
        // can be copied manually. Surface the email failure to the caller.
        emailed = false;
        emailError = e.message;
      }
      return res.status(201).json({ invitation: created[0], emailed, emailError, acceptUrl });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
