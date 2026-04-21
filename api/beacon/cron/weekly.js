// /api/beacon/cron/weekly.js — Weekly cron: generate social posts
// Triggered by Vercel Cron every Monday at 8am CT
const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
  // Verify cron secret (Vercel sends this automatically)
  if (req.headers.authorization !== 'Bearer ' + process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const sql = neon(process.env.DATABASE_URL);

  try {
    // Find all active weekly tasks that are due
    var tasks = await sql`
      SELECT bt.*, bs.plan, bs.tokens_used, bs.tokens_limit, bs.status as sub_status
      FROM beacon_tasks bt
      JOIN beacon_subscriptions bs ON bt.subscription_id = bs.id
      WHERE bt.frequency = 'weekly'
        AND bt.status = 'active'
        AND bs.status = 'active'
        AND (bt.next_run IS NULL OR bt.next_run <= NOW())
    `;

    var results = [];

    for (var i = 0; i < tasks.length; i++) {
      var task = tasks[i];

      // Skip if over token limit
      if (task.tokens_used >= task.tokens_limit) {
        results.push({ task_id: task.id, status: 'skipped', reason: 'token_limit' });
        continue;
      }

      try {
        // Call the generate endpoint internally
        var genResp = await fetch((process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'https://polarispoint.io') + '/api/beacon/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription_id: task.subscription_id,
            type: task.task_type,
            task_id: task.id
          })
        });

        var genData = await genResp.json();

        // Update next_run
        await sql`
          UPDATE beacon_tasks
          SET next_run = NOW() + INTERVAL '7 days'
          WHERE id = ${task.id}
        `;

        results.push({ task_id: task.id, status: 'completed', tokens: genData.tokens_used });
      } catch (e) {
        results.push({ task_id: task.id, status: 'error', error: e.message });
      }
    }

    return res.json({ processed: results.length, results: results });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
