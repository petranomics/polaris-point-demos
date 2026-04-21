// /api/beacon/cron/daily.js — Daily cron: review monitoring
const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
  if (req.headers.authorization !== 'Bearer ' + process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const sql = neon(process.env.DATABASE_URL);

  try {
    // Find monitoring targets that need checking (beacon+ plans only)
    var monitors = await sql`
      SELECT bm.*, bs.plan, bs.status as sub_status
      FROM beacon_monitoring bm
      JOIN beacon_subscriptions bs ON bm.subscription_id = bs.id
      WHERE bs.status = 'active'
        AND bs.plan IN ('beacon', 'pro')
        AND (bm.last_check IS NULL OR bm.last_check < NOW() - INTERVAL '24 hours')
      LIMIT 20
    `;

    var results = [];

    for (var i = 0; i < monitors.length; i++) {
      var mon = monitors[i];

      try {
        if (mon.monitor_type === 'reviews' && mon.target_url) {
          // Scrape review page for updates
          var resp = await fetch(mon.target_url, {
            headers: { 'User-Agent': 'PolarisPoint-Monitor/1.0' },
            signal: AbortSignal.timeout(8000)
          });
          var html = await resp.text();
          var summary = 'Checked ' + mon.target_name + ' at ' + new Date().toISOString();

          await sql`
            UPDATE beacon_monitoring
            SET last_check = NOW(), last_summary = ${summary}
            WHERE id = ${mon.id}
          `;

          results.push({ monitor_id: mon.id, type: mon.monitor_type, status: 'checked' });
        } else if (mon.monitor_type === 'competitor' && mon.target_url) {
          var resp = await fetch(mon.target_url, {
            headers: { 'User-Agent': 'PolarisPoint-Monitor/1.0' },
            signal: AbortSignal.timeout(8000)
          });

          await sql`
            UPDATE beacon_monitoring
            SET last_check = NOW(), last_summary = ${'Competitor site checked: ' + mon.target_name}
            WHERE id = ${mon.id}
          `;

          results.push({ monitor_id: mon.id, type: mon.monitor_type, status: 'checked' });
        }
      } catch (e) {
        results.push({ monitor_id: mon.id, status: 'error', error: e.message });
      }
    }

    return res.json({ monitors_checked: results.length, results: results });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
