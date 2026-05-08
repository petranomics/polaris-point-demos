// /lib/budget.js — Per-tenant monthly spend tracking and cap enforcement.
//
// Concepts:
//   GLOBAL CAP    — env BEACONS_MONTHLY_CAP_USD, default $500. The total $/mo
//                   you (Pete) are willing to spend on Anthropic across all
//                   tenants combined.
//   ALLOCATION %  — column on beacons_tenants. Each tenant gets a slice of
//                   the global pool. tenant.allocation_pct=10 → $50/mo on a
//                   $500 global cap.
//   MTD SPEND     — sum of cost_usd from beacons_usage_log for the tenant
//                   across the current calendar month.
//
// Helper checkBudget(sql, tenant) returns:
//   { spent_usd, allocation_usd, remaining_usd, used_pct, over_cap, near_cap }
//
// Response headers exposed by callers (see chat.js wiring):
//   X-Beacons-Budget-Used      — $ MTD
//   X-Beacons-Budget-Allocation — $ allocated this month
//   X-Beacons-Budget-Remaining  — $ left
//   X-Beacons-Budget-Pct        — 0-100 used
//   X-Beacons-Budget-Status     — 'ok' | 'near_cap' | 'over_cap'
//
// over_cap is the hard stop. near_cap is informational (>=85% used).

const NEAR_CAP_PCT = 85;

function globalCapUsd() {
  const v = parseFloat(process.env.BEACONS_MONTHLY_CAP_USD || '500');
  return isFinite(v) && v > 0 ? v : 500;
}

function tenantAllocationUsd(tenant, globalCap) {
  const cap = (globalCap == null) ? globalCapUsd() : globalCap;
  const pct = Number.isInteger(tenant?.allocation_pct) ? tenant.allocation_pct : 100;
  return Math.max(0, cap * (pct / 100));
}

async function fetchMtdSpend(sql, tenantId) {
  if (!sql || !tenantId) return 0;
  const rows = await sql`
    SELECT COALESCE(SUM(cost_usd),0)::float AS spent
      FROM beacons_usage_log
     WHERE tenant_id = ${tenantId}
       AND created_at >= date_trunc('month', NOW())
  `;
  return rows[0]?.spent || 0;
}

async function checkBudget(sql, tenant) {
  const allocation = tenantAllocationUsd(tenant);
  const spent = await fetchMtdSpend(sql, tenant?.id || null);
  const remaining = Math.max(0, allocation - spent);
  const usedPct = allocation > 0 ? Math.min(100, (spent / allocation) * 100) : 0;
  return {
    spent_usd: round(spent, 4),
    allocation_usd: round(allocation, 2),
    remaining_usd: round(remaining, 4),
    used_pct: round(usedPct, 1),
    over_cap: spent >= allocation,
    near_cap: usedPct >= NEAR_CAP_PCT && spent < allocation
  };
}

function applyBudgetHeaders(res, b) {
  if (!res || !b) return;
  res.setHeader('X-Beacons-Budget-Used',       String(b.spent_usd));
  res.setHeader('X-Beacons-Budget-Allocation', String(b.allocation_usd));
  res.setHeader('X-Beacons-Budget-Remaining',  String(b.remaining_usd));
  res.setHeader('X-Beacons-Budget-Pct',        String(b.used_pct));
  res.setHeader('X-Beacons-Budget-Status',     b.over_cap ? 'over_cap' : (b.near_cap ? 'near_cap' : 'ok'));
}

function round(n, places) {
  const m = Math.pow(10, places);
  return Math.round((Number(n) || 0) * m) / m;
}

module.exports = {
  globalCapUsd,
  tenantAllocationUsd,
  fetchMtdSpend,
  checkBudget,
  applyBudgetHeaders
};
