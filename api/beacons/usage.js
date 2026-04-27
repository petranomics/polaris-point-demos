// /api/beacons/usage.js — Aggregated token-usage + cost stats.
//
// GET → JSON with:
//   currentMonth: { totalUsd, callCount, totalTokens, limitUsd, percentUsed,
//                   byModel: [...], byDay: [...] }
//   lastMonth:    { totalUsd, callCount }
//
// Auth: x-beacons-auth header.

const { neon } = require('@neondatabase/serverless');
const G = require('../../lib/google');
const Pricing = require('../../lib/pricing');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-beacons-auth');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  if (!process.env.BEACONS_PASSCODE_HASH) return res.status(500).json({ error: 'BEACONS_PASSCODE_HASH not configured' });
  if (!process.env.DATABASE_URL) return res.status(500).json({ error: 'DATABASE_URL not configured' });
  if (!G.checkBeaconsAuth(req)) return res.status(401).json({ error: 'Invalid auth' });

  try {
    const sql = neon(process.env.DATABASE_URL);
    await Pricing.ensureUsageTable(sql);

    const monthRows = await sql`
      SELECT
        COALESCE(SUM(cost_usd), 0)::float AS total_usd,
        COUNT(*) AS call_count,
        COALESCE(SUM(input_tokens + output_tokens + cache_creation_tokens + cache_read_tokens), 0) AS total_tokens
      FROM beacons_usage_log
      WHERE created_at >= date_trunc('month', NOW())
    `;
    const month = monthRows[0] || {};

    const lastMonthRows = await sql`
      SELECT
        COALESCE(SUM(cost_usd), 0)::float AS total_usd,
        COUNT(*) AS call_count
      FROM beacons_usage_log
      WHERE created_at >= date_trunc('month', NOW() - INTERVAL '1 month')
        AND created_at <  date_trunc('month', NOW())
    `;
    const lastMonth = lastMonthRows[0] || {};

    const byModelRows = await sql`
      SELECT model, COALESCE(SUM(cost_usd), 0)::float AS usd, COUNT(*) AS calls
      FROM beacons_usage_log
      WHERE created_at >= date_trunc('month', NOW())
      GROUP BY model
      ORDER BY usd DESC
    `;

    const byDayRows = await sql`
      SELECT
        date_trunc('day', created_at) AS day,
        COALESCE(SUM(cost_usd), 0)::float AS usd,
        COUNT(*) AS calls
      FROM beacons_usage_log
      WHERE created_at >= NOW() - INTERVAL '14 days'
      GROUP BY day
      ORDER BY day DESC
    `;

    const limit = Pricing.monthlyLimit();
    const totalUsd = parseFloat(month.total_usd || 0);

    return res.status(200).json({
      currentMonth: {
        totalUsd,
        callCount: parseInt(month.call_count || 0, 10),
        totalTokens: parseInt(month.total_tokens || 0, 10),
        limitUsd: limit,
        percentUsed: Math.min(100, (totalUsd / limit) * 100),
        byModel: byModelRows.map(r => ({
          model: r.model,
          usd: parseFloat(r.usd),
          calls: parseInt(r.calls, 10)
        })),
        byDay: byDayRows.map(r => ({
          day: r.day,
          usd: parseFloat(r.usd),
          calls: parseInt(r.calls, 10)
        }))
      },
      lastMonth: {
        totalUsd: parseFloat(lastMonth.total_usd || 0),
        callCount: parseInt(lastMonth.call_count || 0, 10)
      },
      pricing: Pricing.PRICING
    });
  } catch (err) {
    console.error('usage endpoint error', err);
    return res.status(500).json({ error: err.message || 'Usage query failed' });
  }
};
