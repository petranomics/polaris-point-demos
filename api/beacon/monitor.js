// /api/beacon/monitor.js — CRUD monitoring targets for Beacon subscriptions
const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = neon(process.env.DATABASE_URL);

  try {
    if (req.method === 'GET') {
      var subId = req.query.subscription_id;
      if (!subId) return res.status(400).json({ error: 'Missing subscription_id' });

      var rows = await sql`
        SELECT * FROM beacon_monitoring
        WHERE subscription_id = ${subId}
        ORDER BY created_at ASC
      `;
      return res.json({ monitors: rows });
    }

    if (req.method === 'POST') {
      var body = req.body;
      if (!body.subscription_id || !body.monitor_type) {
        return res.status(400).json({ error: 'Missing subscription_id or monitor_type' });
      }

      var result = await sql`
        INSERT INTO beacon_monitoring (subscription_id, monitor_type, target_url, target_name, config)
        VALUES (${body.subscription_id}, ${body.monitor_type}, ${body.target_url || null}, ${body.target_name || null}, ${body.config ? JSON.stringify(body.config) : null})
        RETURNING *
      `;
      return res.json({ monitor: result[0] });
    }

    if (req.method === 'DELETE') {
      var id = req.query.id;
      if (!id) return res.status(400).json({ error: 'Missing id' });
      await sql`DELETE FROM beacon_monitoring WHERE id = ${id}`;
      return res.json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
