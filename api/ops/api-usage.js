// /api/ops/api-usage.js — Aggregated multi-app API usage data for the ops dashboard.
//
// GET → JSON with totals (today / 24h / MTD / last MTD), per-app breakdown,
// per-model breakdown, 14-day cost trend, and recent activity feed.
//
// Reads from beacons_usage_log (the unified table populated by every app's
// usage-logger). All apps that have logged at least once will appear automatically.
//
// Auth: matches sibling /api/sites pattern — open CORS, gated by /ops UI login.

const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  if (!process.env.DATABASE_URL) return res.status(500).json({ error: 'DATABASE_URL not configured' });

  const sql = neon(process.env.DATABASE_URL);

  try {
    const [totalsRow, todayRow, last24Row, prevMonthRow, byAppRows, byModelRows, byDayRows, recentRows, providerRows] = await Promise.all([
      sql`
        SELECT COALESCE(SUM(cost_usd),0)::float AS cost,
               COUNT(*)::int                    AS calls,
               COALESCE(SUM(input_tokens+output_tokens+cache_creation_tokens+cache_read_tokens),0)::bigint AS tokens
          FROM beacons_usage_log
         WHERE created_at >= date_trunc('month', NOW())`,
      sql`
        SELECT COALESCE(SUM(cost_usd),0)::float AS cost,
               COUNT(*)::int AS calls
          FROM beacons_usage_log
         WHERE created_at >= date_trunc('day', NOW())`,
      sql`
        SELECT COALESCE(SUM(cost_usd),0)::float AS cost,
               COUNT(*)::int AS calls
          FROM beacons_usage_log
         WHERE created_at >= NOW() - INTERVAL '24 hours'`,
      sql`
        SELECT COALESCE(SUM(cost_usd),0)::float AS cost,
               COUNT(*)::int AS calls
          FROM beacons_usage_log
         WHERE created_at >= date_trunc('month', NOW() - INTERVAL '1 month')
           AND created_at <  date_trunc('month', NOW())`,
      sql`
        SELECT COALESCE(app,'beacons')                        AS app,
               COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::int  AS calls_24h,
               COUNT(*) FILTER (WHERE created_at >= date_trunc('month', NOW()))::int   AS calls_mtd,
               COALESCE(SUM(cost_usd) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours'),0)::float AS cost_24h,
               COALESCE(SUM(cost_usd) FILTER (WHERE created_at >= date_trunc('month', NOW())),0)::float AS cost_mtd,
               COALESCE(AVG(latency_ms) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days' AND latency_ms IS NOT NULL),0)::int AS avg_latency_ms,
               MAX(created_at) AS last_seen
          FROM beacons_usage_log
         WHERE created_at >= NOW() - INTERVAL '30 days'
         GROUP BY app
         ORDER BY cost_mtd DESC, calls_mtd DESC`,
      sql`
        SELECT COALESCE(model,'unknown')    AS model,
               COALESCE(provider,'anthropic') AS provider,
               COUNT(*)::int                AS calls,
               COALESCE(SUM(cost_usd),0)::float AS cost
          FROM beacons_usage_log
         WHERE created_at >= date_trunc('month', NOW())
         GROUP BY model, provider
         ORDER BY cost DESC, calls DESC
         LIMIT 20`,
      sql`
        SELECT date_trunc('day', created_at)        AS day,
               COALESCE(SUM(cost_usd),0)::float     AS cost,
               COUNT(*)::int                        AS calls
          FROM beacons_usage_log
         WHERE created_at >= NOW() - INTERVAL '14 days'
         GROUP BY day
         ORDER BY day ASC`,
      sql`
        SELECT created_at, app, endpoint, model, provider,
               cost_usd::float                              AS cost_usd,
               latency_ms,
               (input_tokens + output_tokens + cache_creation_tokens + cache_read_tokens) AS tokens
          FROM beacons_usage_log
         ORDER BY created_at DESC
         LIMIT 30`,
      sql`
        SELECT COALESCE(provider,'anthropic')    AS provider,
               COUNT(*)::int                     AS calls,
               COALESCE(SUM(cost_usd),0)::float  AS cost
          FROM beacons_usage_log
         WHERE created_at >= date_trunc('month', NOW())
         GROUP BY provider
         ORDER BY cost DESC`,
    ]);

    return res.status(200).json({
      generated_at: new Date().toISOString(),
      totals: {
        mtd:       { cost: totalsRow[0].cost, calls: totalsRow[0].calls, tokens: Number(totalsRow[0].tokens) },
        today:     { cost: todayRow[0].cost,  calls: todayRow[0].calls },
        last24h:   { cost: last24Row[0].cost, calls: last24Row[0].calls },
        prevMonth: { cost: prevMonthRow[0].cost, calls: prevMonthRow[0].calls },
      },
      by_app:      byAppRows,
      by_model:    byModelRows,
      by_provider: providerRows,
      by_day:      byDayRows,
      recent:      recentRows,
    });
  } catch (err) {
    console.error('api-usage endpoint error', err);
    return res.status(500).json({ error: err.message || 'Query failed' });
  }
};
