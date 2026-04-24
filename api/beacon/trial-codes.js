// /api/beacon/trial-codes.js — Admin: create/list/delete trial codes
const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = neon(process.env.DATABASE_URL);

  try {
    if (req.method === 'GET') {
      var rows = await sql`
        SELECT * FROM beacon_trial_codes
        ORDER BY created_at DESC
      `;
      return res.json({ codes: rows });
    }

    if (req.method === 'POST') {
      var b = req.body;
      var code = (b.code || ('BETA-' + Math.random().toString(36).substring(2, 8).toUpperCase())).toUpperCase();
      var tier = b.tier || 'lite';
      var weeks = b.trial_weeks || 6;
      var maxUses = b.max_uses || 1;
      var notes = b.notes || '';
      var industry = b.industry || 'general';
      var createdBy = b.created_by || 'admin';
      var expires = b.expires_at || null;

      var result = await sql`
        INSERT INTO beacon_trial_codes (code, tier, trial_weeks, max_uses, notes, industry, created_by, expires_at)
        VALUES (${code}, ${tier}, ${weeks}, ${maxUses}, ${notes}, ${industry}, ${createdBy}, ${expires})
        RETURNING *
      `;
      return res.json({ code: result[0] });
    }

    if (req.method === 'DELETE') {
      var id = req.query.id;
      if (!id) return res.status(400).json({ error: 'Missing id' });
      await sql`DELETE FROM beacon_trial_codes WHERE id = ${id}`;
      return res.json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
