// /api/beacon/cron/quarterly.js — Quarterly cron: growth strategy reports (Pro only)
const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
  if (req.headers.authorization !== 'Bearer ' + process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const sql = neon(process.env.DATABASE_URL);

  try {
    var tasks = await sql`
      SELECT bt.*, bs.plan, bs.tokens_used, bs.tokens_limit
      FROM beacon_tasks bt
      JOIN beacon_subscriptions bs ON bt.subscription_id = bs.id
      WHERE bt.frequency = 'quarterly'
        AND bt.status = 'active'
        AND bs.status = 'active'
        AND bs.plan = 'pro'
        AND (bt.next_run IS NULL OR bt.next_run <= NOW())
    `;

    var results = [];
    var baseUrl = process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'https://polarispoint.io';

    for (var i = 0; i < tasks.length; i++) {
      var task = tasks[i];
      if (task.tokens_used >= task.tokens_limit) {
        results.push({ task_id: task.id, status: 'skipped' });
        continue;
      }

      try {
        var genResp = await fetch(baseUrl + '/api/beacon/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription_id: task.subscription_id,
            type: 'growth_strategy',
            task_id: task.id,
            custom_prompt: 'Create a quarterly growth strategy report. Analyze the business context, competitive landscape, and recent performance. Provide 5-7 specific, actionable recommendations with expected impact. Include timeline and priority for each recommendation.'
          })
        });

        var genData = await genResp.json();

        await sql`
          UPDATE beacon_tasks SET next_run = NOW() + INTERVAL '90 days' WHERE id = ${task.id}
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
