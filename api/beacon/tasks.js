// /api/beacon/tasks.js — CRUD scheduled tasks for Beacon subscriptions
const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = neon(process.env.DATABASE_URL);

  try {
    if (req.method === 'GET') {
      var subId = req.query.subscription_id;
      if (!subId) return res.status(400).json({ error: 'Missing subscription_id' });

      var rows = await sql`
        SELECT * FROM beacon_tasks
        WHERE subscription_id = ${subId}
        ORDER BY next_run ASC
      `;
      return res.json({ tasks: rows });
    }

    if (req.method === 'POST') {
      var body = req.body;
      if (!body.subscription_id || !body.task_type || !body.frequency) {
        return res.status(400).json({ error: 'Missing subscription_id, task_type, or frequency' });
      }

      var nextRun = body.next_run || new Date(Date.now() + 7 * 86400000).toISOString();
      var result = await sql`
        INSERT INTO beacon_tasks (subscription_id, task_type, frequency, next_run, config)
        VALUES (${body.subscription_id}, ${body.task_type}, ${body.frequency}, ${nextRun}, ${body.config ? JSON.stringify(body.config) : null})
        RETURNING *
      `;
      return res.json({ task: result[0] });
    }

    if (req.method === 'PUT') {
      var id = req.query.id;
      if (!id) return res.status(400).json({ error: 'Missing id' });
      var body = req.body;

      var result = await sql`
        UPDATE beacon_tasks
        SET status = COALESCE(${body.status || null}, status),
            frequency = COALESCE(${body.frequency || null}, frequency),
            next_run = COALESCE(${body.next_run || null}, next_run),
            config = COALESCE(${body.config ? JSON.stringify(body.config) : null}, config)
        WHERE id = ${id}
        RETURNING *
      `;
      return res.json({ task: result[0] });
    }

    if (req.method === 'DELETE') {
      var id = req.query.id;
      if (!id) return res.status(400).json({ error: 'Missing id' });
      await sql`DELETE FROM beacon_tasks WHERE id = ${id}`;
      return res.json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
