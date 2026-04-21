// /api/beacon/cron/monthly.js — Monthly cron: newsletters, reports, token reset
const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
  if (req.headers.authorization !== 'Bearer ' + process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const sql = neon(process.env.DATABASE_URL);

  try {
    // 1. Reset tokens for subscriptions whose billing period has lapsed
    var resets = await sql`
      UPDATE beacon_subscriptions
      SET tokens_used = 0,
          billing_period_start = CURRENT_DATE,
          updated_at = NOW()
      WHERE status = 'active'
        AND billing_period_start + INTERVAL '30 days' <= CURRENT_DATE
      RETURNING id, plan
    `;

    // 2. Process monthly tasks (newsletters, competitor reports, blogs)
    var tasks = await sql`
      SELECT bt.*, bs.plan, bs.tokens_used, bs.tokens_limit, bs.status as sub_status
      FROM beacon_tasks bt
      JOIN beacon_subscriptions bs ON bt.subscription_id = bs.id
      WHERE bt.frequency = 'monthly'
        AND bt.status = 'active'
        AND bs.status = 'active'
        AND (bt.next_run IS NULL OR bt.next_run <= NOW())
    `;

    var taskResults = [];
    var baseUrl = process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'https://polarispoint.io';

    for (var i = 0; i < tasks.length; i++) {
      var task = tasks[i];
      if (task.tokens_used >= task.tokens_limit) {
        taskResults.push({ task_id: task.id, status: 'skipped' });
        continue;
      }

      try {
        var genResp = await fetch(baseUrl + '/api/beacon/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription_id: task.subscription_id,
            type: task.task_type,
            task_id: task.id
          })
        });

        var genData = await genResp.json();

        await sql`
          UPDATE beacon_tasks SET next_run = NOW() + INTERVAL '30 days' WHERE id = ${task.id}
        `;

        taskResults.push({ task_id: task.id, status: 'completed', tokens: genData.tokens_used });
      } catch (e) {
        taskResults.push({ task_id: task.id, status: 'error', error: e.message });
      }
    }

    return res.json({
      tokens_reset: resets.length,
      tasks_processed: taskResults.length,
      results: taskResults
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
