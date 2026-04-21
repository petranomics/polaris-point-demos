// /api/apply.js — Receive job applications
// Stores in Neon DB + sends email notification
const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = neon(process.env.DATABASE_URL);

  // GET — list applications (admin use)
  if (req.method === 'GET') {
    try {
      var rows = await sql`
        SELECT id, first_name, last_name, email, phone, location, role,
               why, superpower, portfolio, notes, resume_name, status, created_at
        FROM applications
        ORDER BY created_at DESC
      `;
      return res.json({ applications: rows });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // POST — submit application
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    var b = req.body;
    if (!b.first_name || !b.last_name || !b.email || !b.role || !b.why) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create table if not exists
    await sql`
      CREATE TABLE IF NOT EXISTS applications (
        id SERIAL PRIMARY KEY,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        location TEXT,
        role TEXT NOT NULL,
        why TEXT NOT NULL,
        superpower TEXT,
        portfolio TEXT,
        notes TEXT,
        resume_name TEXT,
        resume_data TEXT,
        status TEXT DEFAULT 'new',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      INSERT INTO applications (first_name, last_name, email, phone, location, role, why, superpower, portfolio, notes, resume_name, resume_data)
      VALUES (${b.first_name}, ${b.last_name}, ${b.email}, ${b.phone || ''}, ${b.location || ''},
              ${b.role}, ${b.why}, ${b.superpower || ''}, ${b.portfolio || ''}, ${b.notes || ''},
              ${b.resume_name || ''}, ${b.resume_base64 || ''})
    `;

    return res.json({ success: true, message: 'Application received' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
