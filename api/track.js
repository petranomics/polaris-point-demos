// /api/track.js — Lightweight analytics event tracker
// POST /api/track { site, event, path, referrer, sessionId, meta }
// GET /api/track?site=x&range=7d — query analytics (admin)
const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = neon(process.env.DATABASE_URL);

  try {
    // POST — log an event
    if (req.method === 'POST') {
      var b = req.body;
      if (!b || !b.site) return res.status(400).json({ error: 'site required' });

      var ip = (req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '').split(',')[0].trim();
      var ua = req.headers['user-agent'] || '';

      await sql`
        INSERT INTO analytics (site, event, path, referrer, user_agent, ip, session_id, meta)
        VALUES (${b.site}, ${b.event || 'pageview'}, ${b.path || '/'},
          ${b.referrer || ''}, ${ua}, ${ip}, ${b.sessionId || ''},
          ${b.meta ? JSON.stringify(b.meta) : null})
      `;

      // Return 1x1 transparent gif for image-based tracking fallback
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ ok: true });
    }

    // GET — query analytics for admin dashboard
    if (req.method === 'GET') {
      var site = req.query.site;
      var range = req.query.range || '7d';
      var days = parseInt(range) || 7;

      var rows;
      if (site && site !== 'all') {
        rows = await sql`
          SELECT
            site,
            event,
            path,
            DATE(created_at) as day,
            COUNT(*) as count
          FROM analytics
          WHERE site = ${site}
            AND created_at > NOW() - INTERVAL '1 day' * ${days}
          GROUP BY site, event, path, DATE(created_at)
          ORDER BY day DESC, count DESC
        `;
      } else {
        rows = await sql`
          SELECT
            site,
            event,
            DATE(created_at) as day,
            COUNT(*) as count
          FROM analytics
          WHERE created_at > NOW() - INTERVAL '1 day' * ${days}
          GROUP BY site, event, DATE(created_at)
          ORDER BY day DESC, count DESC
        `;
      }

      // Also get summary totals
      var summaryQuery = site && site !== 'all'
        ? sql`
          SELECT
            COUNT(*) as total_events,
            COUNT(DISTINCT session_id) FILTER (WHERE session_id != '') as unique_sessions,
            COUNT(*) FILTER (WHERE event = 'pageview') as pageviews,
            COUNT(*) FILTER (WHERE event = 'form_submit') as form_submits,
            COUNT(*) FILTER (WHERE event = 'call_click') as call_clicks,
            COUNT(*) FILTER (WHERE event = 'booking_click') as booking_clicks,
            COUNT(DISTINCT ip) FILTER (WHERE ip != '') as unique_ips
          FROM analytics
          WHERE site = ${site} AND created_at > NOW() - INTERVAL '1 day' * ${days}
        `
        : sql`
          SELECT
            COUNT(*) as total_events,
            COUNT(DISTINCT session_id) FILTER (WHERE session_id != '') as unique_sessions,
            COUNT(*) FILTER (WHERE event = 'pageview') as pageviews,
            COUNT(*) FILTER (WHERE event = 'form_submit') as form_submits,
            COUNT(*) FILTER (WHERE event = 'call_click') as call_clicks,
            COUNT(*) FILTER (WHERE event = 'booking_click') as booking_clicks,
            COUNT(DISTINCT ip) FILTER (WHERE ip != '') as unique_ips
          FROM analytics
          WHERE created_at > NOW() - INTERVAL '1 day' * ${days}
        `;

      var summary = await summaryQuery;

      // Get per-site breakdown
      var sites = await sql`
        SELECT
          site,
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE event = 'pageview') as pageviews,
          COUNT(*) FILTER (WHERE event = 'form_submit') as forms,
          COUNT(*) FILTER (WHERE event = 'call_click') as calls
        FROM analytics
        WHERE created_at > NOW() - INTERVAL '1 day' * ${days}
        GROUP BY site
        ORDER BY total DESC
      `;

      return res.status(200).json({
        summary: summary[0] || {},
        sites: sites,
        daily: rows
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
