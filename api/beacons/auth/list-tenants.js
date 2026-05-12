// /api/beacons/auth/list-tenants.js — Admin: list all tenants with MTD spend
// joined from beacons_usage_log.
//
// GET /api/beacons/auth/list-tenants → { tenants: [...] }
// Auth: x-beacons-admin-key header.
//
// Each tenant row includes: id, email, display_name, tier, allocation_pct,
// is_admin, settings, created_at, updated_at, plus MTD aggregates:
//   - mtd_spend_usd
//   - mtd_calls
//   - last_activity (most recent usage_log timestamp, or null)
//
// Used by the /admin page to populate the tenant table.

const { neon } = require('@neondatabase/serverless');
const Auth = require('../../../lib/auth');
const Pricing = require('../../../lib/pricing');

function adminAuthOk(req) {
  const expected = process.env.BEACONS_ADMIN_KEY;
  if (!expected || expected.length < 16) return false;
  const got = (req.headers['x-beacons-admin-key'] || '').toString();
  if (got.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < got.length; i++) mismatch |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  return mismatch === 0;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-beacons-admin-key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  if (!process.env.DATABASE_URL)      return res.status(500).json({ error: 'DATABASE_URL not configured' });
  if (!process.env.BEACONS_ADMIN_KEY) return res.status(500).json({ error: 'BEACONS_ADMIN_KEY not configured' });
  if (!adminAuthOk(req))              return res.status(401).json({ error: 'Invalid admin key' });

  const sql = neon(process.env.DATABASE_URL);
  await Auth.ensureTenantsTable(sql);
  await Pricing.ensureUsageTable(sql);

  const rows = await sql`
    SELECT
      t.id, t.email, t.display_name, t.tier, t.allocation_pct,
      t.settings, t.is_admin, t.created_at, t.updated_at,
      COALESCE(SUM(u.cost_usd) FILTER (WHERE u.created_at >= date_trunc('month', NOW())), 0)::float AS mtd_spend_usd,
      COUNT(u.id) FILTER (WHERE u.created_at >= date_trunc('month', NOW()))::int AS mtd_calls,
      MAX(u.created_at) AS last_activity
    FROM beacons_tenants t
    LEFT JOIN beacons_usage_log u ON u.tenant_id = t.id
    GROUP BY t.id
    ORDER BY t.created_at DESC
  `;

  const tenants = rows.map(r => {
    const tier = Auth.TIERS[r.tier] || Auth.TIERS.basic;
    return {
      ...Auth.publicTenant(r),
      mtd_spend_usd: Number((r.mtd_spend_usd || 0).toFixed(4)),
      mtd_calls: Number(r.mtd_calls || 0),
      last_activity: r.last_activity,
      tier_info: {
        monthly_price_usd: tier.monthly_price_usd,
        opus_allowed: tier.opus_allowed
      }
    };
  });

  return res.status(200).json({ tenants, count: tenants.length });
};
