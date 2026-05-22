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

  // Optional ?app=xxx and ?tenant_id=xxx filters apply to every query except
  // by_app and by_tenant (those drive the dropdowns and must show all options).
  const appRaw = (req.query.app || '').toString().trim();
  const appFilter = appRaw && appRaw !== 'all' ? appRaw : null;
  const tenantRaw = (req.query.tenant_id || '').toString().trim();
  const tenantFilter = tenantRaw && tenantRaw !== 'all' ? tenantRaw : null;

  try {
    const [totalsRow, todayRow, last24Row, prevMonthRow, byAppRows, byModelRows, byDayRows, recentRows, providerRows, byTenantRows] = await Promise.all([
      sql`
        SELECT COALESCE(SUM(cost_usd),0)::float AS cost,
               COUNT(*)::int                    AS calls,
               COALESCE(SUM(input_tokens+output_tokens+cache_creation_tokens+cache_read_tokens),0)::bigint AS tokens
          FROM beacons_usage_log
         WHERE created_at >= date_trunc('month', NOW())
           AND (${appFilter}::text IS NULL OR COALESCE(app,'beacons') = ${appFilter})
           AND (${tenantFilter}::text IS NULL OR tenant_id = ${tenantFilter})`,
      sql`
        SELECT COALESCE(SUM(cost_usd),0)::float AS cost,
               COUNT(*)::int AS calls
          FROM beacons_usage_log
         WHERE created_at >= date_trunc('day', NOW())
           AND (${appFilter}::text IS NULL OR COALESCE(app,'beacons') = ${appFilter})
           AND (${tenantFilter}::text IS NULL OR tenant_id = ${tenantFilter})`,
      sql`
        SELECT COALESCE(SUM(cost_usd),0)::float AS cost,
               COUNT(*)::int AS calls
          FROM beacons_usage_log
         WHERE created_at >= NOW() - INTERVAL '24 hours'
           AND (${appFilter}::text IS NULL OR COALESCE(app,'beacons') = ${appFilter})
           AND (${tenantFilter}::text IS NULL OR tenant_id = ${tenantFilter})`,
      sql`
        SELECT COALESCE(SUM(cost_usd),0)::float AS cost,
               COUNT(*)::int AS calls
          FROM beacons_usage_log
         WHERE created_at >= date_trunc('month', NOW() - INTERVAL '1 month')
           AND created_at <  date_trunc('month', NOW())
           AND (${appFilter}::text IS NULL OR COALESCE(app,'beacons') = ${appFilter})
           AND (${tenantFilter}::text IS NULL OR tenant_id = ${tenantFilter})`,
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
           AND (${appFilter}::text IS NULL OR COALESCE(app,'beacons') = ${appFilter})
           AND (${tenantFilter}::text IS NULL OR tenant_id = ${tenantFilter})
         GROUP BY model, provider
         ORDER BY cost DESC, calls DESC
         LIMIT 20`,
      // Gap-filled: generate_series guarantees one row per day for the last
      // 14 days even when a day has zero usage, so the chart always shows 14
      // sequential bars/dates instead of skipping empty days. Filters live in
      // the LEFT JOIN's ON clause so they don't drop the zero days.
      sql`
        SELECT d.day                                  AS day,
               COALESCE(SUM(l.cost_usd),0)::float     AS cost,
               COUNT(l.id)::int                       AS calls
          FROM generate_series(
                 date_trunc('day', NOW()) - INTERVAL '13 days',
                 date_trunc('day', NOW()),
                 INTERVAL '1 day'
               ) AS d(day)
          LEFT JOIN beacons_usage_log l
            ON date_trunc('day', l.created_at) = d.day
           AND (${appFilter}::text IS NULL OR COALESCE(l.app,'beacons') = ${appFilter})
           AND (${tenantFilter}::text IS NULL OR l.tenant_id = ${tenantFilter})
         GROUP BY d.day
         ORDER BY d.day ASC`,
      sql`
        SELECT u.created_at, u.app, u.endpoint, u.model, u.provider, u.tenant_id,
               t.display_name                               AS tenant_name,
               u.cost_usd::float                            AS cost_usd,
               u.latency_ms,
               (u.input_tokens + u.output_tokens + u.cache_creation_tokens + u.cache_read_tokens) AS tokens
          FROM beacons_usage_log u
          LEFT JOIN beacons_tenants t ON t.id = u.tenant_id
         WHERE (${appFilter}::text IS NULL OR COALESCE(u.app,'beacons') = ${appFilter})
           AND (${tenantFilter}::text IS NULL OR u.tenant_id = ${tenantFilter})
         ORDER BY u.created_at DESC
         LIMIT 30`,
      sql`
        SELECT COALESCE(provider,'anthropic')    AS provider,
               COUNT(*)::int                     AS calls,
               COALESCE(SUM(cost_usd),0)::float  AS cost
          FROM beacons_usage_log
         WHERE created_at >= date_trunc('month', NOW())
           AND (${appFilter}::text IS NULL OR COALESCE(app,'beacons') = ${appFilter})
           AND (${tenantFilter}::text IS NULL OR tenant_id = ${tenantFilter})
         GROUP BY provider
         ORDER BY cost DESC`,
      sql`
        SELECT u.tenant_id                                                AS tenant_id,
               COALESCE(t.display_name, t.email, u.tenant_id)             AS display_name,
               COALESCE(t.tier, '—')                                      AS tier,
               COUNT(*) FILTER (WHERE u.created_at >= NOW() - INTERVAL '24 hours')::int  AS calls_24h,
               COUNT(*) FILTER (WHERE u.created_at >= date_trunc('month', NOW()))::int   AS calls_mtd,
               COALESCE(SUM(u.cost_usd) FILTER (WHERE u.created_at >= NOW() - INTERVAL '24 hours'),0)::float AS cost_24h,
               COALESCE(SUM(u.cost_usd) FILTER (WHERE u.created_at >= date_trunc('month', NOW())),0)::float AS cost_mtd,
               MAX(u.created_at)                                          AS last_seen
          FROM beacons_usage_log u
          LEFT JOIN beacons_tenants t ON t.id = u.tenant_id
         WHERE u.tenant_id IS NOT NULL
           AND u.created_at >= NOW() - INTERVAL '30 days'
           AND (${appFilter}::text IS NULL OR COALESCE(u.app,'beacons') = ${appFilter})
         GROUP BY u.tenant_id, t.display_name, t.email, t.tier
         ORDER BY cost_mtd DESC, calls_mtd DESC`,
    ]);

    return res.status(200).json({
      generated_at: new Date().toISOString(),
      app_filter: appFilter,
      tenant_filter: tenantFilter,
      totals: {
        mtd:       { cost: totalsRow[0].cost, calls: totalsRow[0].calls, tokens: Number(totalsRow[0].tokens) },
        today:     { cost: todayRow[0].cost,  calls: todayRow[0].calls },
        last24h:   { cost: last24Row[0].cost, calls: last24Row[0].calls },
        prevMonth: { cost: prevMonthRow[0].cost, calls: prevMonthRow[0].calls },
      },
      by_app:      byAppRows,
      by_tenant:   byTenantRows,
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
