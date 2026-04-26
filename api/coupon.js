// /api/coupon.js — Per-user coupon codes for sales credit on flyers
const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = neon(process.env.DATABASE_URL);

  try {
    // Ensure column exists
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS coupon_code TEXT`;

    if (req.method === 'GET') {
      // ?action=list — senior only, list everyone's codes
      if (req.query.action === 'list') {
        var rows = await sql`
          SELECT id, username, full_name, role, coupon_code
          FROM users
          WHERE active = true
          ORDER BY full_name ASC
        `;
        return res.json({ users: rows });
      }
      // Get current user's code by username
      var username = req.query.username;
      if (!username) return res.status(400).json({ error: 'Missing username' });
      var u = await sql`SELECT coupon_code FROM users WHERE username = ${username} LIMIT 1`;
      if (!u.length) return res.status(404).json({ error: 'User not found' });
      return res.json({ coupon_code: u[0].coupon_code || '' });
    }

    if (req.method === 'POST') {
      var b = req.body || {};
      if (!b.username || !b.coupon_code) {
        return res.status(400).json({ error: 'Missing username or coupon_code' });
      }
      var code = String(b.coupon_code).toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 20);
      if (!code) return res.status(400).json({ error: 'Coupon code must be alphanumeric' });

      // Check for collision (no two users with same code)
      var existing = await sql`
        SELECT username FROM users
        WHERE coupon_code = ${code} AND username != ${b.username}
        LIMIT 1
      `;
      if (existing.length) {
        return res.status(409).json({ error: 'That code is already in use by another staff member' });
      }

      await sql`UPDATE users SET coupon_code = ${code} WHERE username = ${b.username}`;
      return res.json({ success: true, coupon_code: code });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
