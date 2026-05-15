// /api/beacons/usage.js — Tenant-scoped usage stats + tier limits.
//
// GET → JSON with:
//   tier:         string (the tenant's current tier)
//   limits:       full tier-limits.js object for this tier
//   currentMonth: { totalUsd, callCount, totalTokens, limitUsd, percentUsed,
//                   byModel: [...], byDay: [...] }
//   lastMonth:    { totalUsd, callCount }
//   inquiries:    { used, limit, percentUsed }   ← null if tier has no limit
//   library:      { items, sizeBytes, sizeLimitMb, percentUsed }
//   activity:     { level: 'green'|'amber'|'red', percentUsed }
//
// Auth: Authorization header (Bearer JWT) via Auth.resolveTenant.

const { neon } = require('@neondatabase/serverless');
const Auth = require('../../lib/auth');
const Pricing = require('../../lib/pricing');
const TierResolver = require('../../lib/resolve-tier');

// Activity dot thresholds — keyed to expected fair-use spend, NOT hard cap.
// Expected ≈ 25% of plan price (Pete's targeting — leaves ~75% gross margin).
// Internal-only — never shown as $ in UI.
//   Spark      ($129)  → ~$32 expected (paranoid: keep at $25 for headroom)
//   Beam       ($249)  → ~$62 (keep at $50)
//   Lighthouse ($499)  → ~$125 (keep at $100)
const TIER_EXPECTED_USD = {
  free:       2,
  spark:      25,
  beam:       50,
  lighthouse: 100,
  pete:       9999,
  // Legacy aliases — same numbers, different keys, kept until DB migrates.
  basic:      25,
  premium:    50,
  pro:        100,
};

function activityLevel(pctOfExpected) {
  if (pctOfExpected >= 160) return 'red';
  if (pctOfExpected >= 100) return 'amber';
  return 'green';
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-beacons-auth, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  if (!process.env.DATABASE_URL) return res.status(500).json({ error: 'DATABASE_URL not configured' });

  const tenant = await Auth.resolveTenant(req);
  if (!tenant) return res.status(401).json({ error: 'Invalid or missing auth' });

  try {
    const sql = neon(process.env.DATABASE_URL);
    await Pricing.ensureUsageTable(sql);

    const { tier, limits } = TierResolver.fromTenant(tenant);

    // Tenant-scoped MTD aggregates
    const monthRows = await sql`
      SELECT
        COALESCE(SUM(cost_usd), 0)::float AS total_usd,
        COUNT(*) AS call_count,
        COALESCE(SUM(input_tokens + output_tokens + cache_creation_tokens + cache_read_tokens), 0) AS total_tokens
      FROM beacons_usage_log
      WHERE tenant_id = ${tenant.id}
        AND created_at >= date_trunc('month', NOW())
    `;
    const month = monthRows[0] || {};

    const lastMonthRows = await sql`
      SELECT
        COALESCE(SUM(cost_usd), 0)::float AS total_usd,
        COUNT(*) AS call_count
      FROM beacons_usage_log
      WHERE tenant_id = ${tenant.id}
        AND created_at >= date_trunc('month', NOW() - INTERVAL '1 month')
        AND created_at <  date_trunc('month', NOW())
    `;
    const lastMonth = lastMonthRows[0] || {};

    const byModelRows = await sql`
      SELECT model, COALESCE(SUM(cost_usd), 0)::float AS usd, COUNT(*) AS calls
      FROM beacons_usage_log
      WHERE tenant_id = ${tenant.id}
        AND created_at >= date_trunc('month', NOW())
      GROUP BY model
      ORDER BY usd DESC
    `;

    const byDayRows = await sql`
      SELECT
        date_trunc('day', created_at) AS day,
        COALESCE(SUM(cost_usd), 0)::float AS usd,
        COUNT(*) AS calls
      FROM beacons_usage_log
      WHERE tenant_id = ${tenant.id}
        AND created_at >= NOW() - INTERVAL '14 days'
      GROUP BY day
      ORDER BY day DESC
    `;

    // Library size for this tenant — sum of file sizes from beacons_items
    const libRows = await sql`
      SELECT
        COUNT(*) AS items,
        COALESCE(SUM(((data->>'size')::bigint)), 0) AS total_bytes
      FROM beacons_items
      WHERE tenant_id = ${tenant.id}
        AND kind = 'file'
    `;
    const lib = libRows[0] || { items: 0, total_bytes: 0 };
    const libBytes = parseInt(lib.total_bytes || 0, 10);
    const libMb = libBytes / (1024 * 1024);

    const limit = Pricing.monthlyLimit();
    const totalUsd = parseFloat(month.total_usd || 0);

    // Activity dot — green/amber/red based on % of TIER_EXPECTED_USD.
    const expected = TIER_EXPECTED_USD[tier] || TIER_EXPECTED_USD.basic;
    const pctOfExpected = expected > 0 ? (totalUsd / expected) * 100 : 0;
    const level = activityLevel(pctOfExpected);

    // Inquiry counter — null if tier is unlimited
    const callCount = parseInt(month.call_count || 0, 10);
    const inqLimit = limits.inquiries_mo;
    const inqPct = (inqLimit && inqLimit > 0) ? Math.min(100, (callCount / inqLimit) * 100) : null;

    // Library meter
    const libLimit = limits.library_mb;
    const libPct = (libLimit && libLimit > 0) ? Math.min(100, (libMb / libLimit) * 100) : null;

    return res.status(200).json({
      tier,
      limits,
      currentMonth: {
        totalUsd,
        callCount,
        totalTokens: parseInt(month.total_tokens || 0, 10),
        limitUsd: limit,
        percentUsed: Math.min(100, (totalUsd / limit) * 100),
        byModel: byModelRows.map(r => ({ model: r.model, usd: parseFloat(r.usd), calls: parseInt(r.calls, 10) })),
        byDay: byDayRows.map(r => ({ day: r.day, usd: parseFloat(r.usd), calls: parseInt(r.calls, 10) })),
      },
      lastMonth: {
        totalUsd: parseFloat(lastMonth.total_usd || 0),
        callCount: parseInt(lastMonth.call_count || 0, 10),
      },
      inquiries: inqLimit === null || inqLimit === undefined
        ? null
        : { used: callCount, limit: inqLimit, percentUsed: inqPct },
      library: {
        items: parseInt(lib.items || 0, 10),
        sizeBytes: libBytes,
        sizeMb: Number(libMb.toFixed(2)),
        sizeLimitMb: libLimit,
        percentUsed: libPct,
      },
      activity: {
        level,
        percentOfExpected: Number(pctOfExpected.toFixed(1)),
      },
      pricing: Pricing.PRICING,
    });
  } catch (err) {
    console.error('usage endpoint error', err);
    return res.status(500).json({ error: err.message || 'Usage query failed' });
  }
};
