// /api/users.js — User management + login
const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = neon(process.env.DATABASE_URL);

  try {
    // POST /api/users?action=login — authenticate
    if (req.method === 'POST' && req.query.action === 'login') {
      var b = req.body;
      if (!b || !b.username || !b.password_hash) return res.status(400).json({ error: 'Missing credentials' });
      var rows = await sql`SELECT * FROM users WHERE username = ${b.username.toLowerCase()} AND password_hash = ${b.password_hash} AND active = true`;
      if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });
      var u = rows[0];
      return res.status(200).json({ id: u.id, username: u.username, full_name: u.full_name, role: u.role, email: u.email });
    }

    // POST /api/users — register new user
    if (req.method === 'POST') {
      var b = req.body;
      if (!b || !b.username || !b.password_hash || !b.full_name) return res.status(400).json({ error: 'Missing required fields' });
      var existing = await sql`SELECT id FROM users WHERE username = ${b.username.toLowerCase()}`;
      if (existing.length) return res.status(409).json({ error: 'Username already taken' });
      var result = await sql`
        INSERT INTO users (username, password_hash, full_name, role, email)
        VALUES (${b.username.toLowerCase()}, ${b.password_hash}, ${b.full_name}, ${b.role || 'junior'}, ${b.email || ''})
        RETURNING id, username, full_name, role, email
      `;
      return res.status(201).json({ user: result[0] });
    }

    // GET /api/users — list all users
    if (req.method === 'GET') {
      var rows = await sql`SELECT id, username, full_name, role, email, active, created_at FROM users ORDER BY created_at ASC`;
      return res.status(200).json({ users: rows });
    }

    // PUT /api/users?id=x — update user
    if (req.method === 'PUT') {
      var id = req.query.id;
      if (!id) return res.status(400).json({ error: 'id required' });
      var b = req.body;
      var result = await sql`
        UPDATE users SET
          full_name = COALESCE(${b.full_name || null}, full_name),
          role = COALESCE(${b.role || null}, role),
          email = COALESCE(${b.email || null}, email),
          active = COALESCE(${b.active != null ? b.active : null}, active),
          updated_at = NOW()
        WHERE id = ${id}
        RETURNING id, username, full_name, role, email, active
      `;
      if (!result.length) return res.status(404).json({ error: 'User not found' });
      return res.status(200).json({ user: result[0] });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
