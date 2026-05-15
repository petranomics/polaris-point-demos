// /lib/resolve-tier.js — Resolve a request to {tier, limits} regardless of
// which system the caller came from.
//
// System 1 (beacons_tenants — direct polarispoint.io/beacon users):
//   pass a `tenant` row → uses tenant.tier directly
//
// System 2 (beacon_subscriptions — branded SMB widgets):
//   pass a `subscription` row → maps subscription.plan to tier via PLAN_TIER_MAP
//
// Custom per-customer overrides (e.g. enterprise dashboards with bespoke
// caps) live in tenant.settings.limits as a partial JSONB object. Any
// fields present there override the tier defaults; missing fields fall
// through to the tier table. This lets a "pro" customer get pro defaults
// plus {rag_tokens: 60000} as a one-off without forking the tier.

const { getLimits, planToTier, normalizeTier } = require('./tier-limits');

function deepMerge(base, override) {
  if (!override || typeof override !== 'object') return base;
  const out = { ...base };
  for (const k of Object.keys(override)) {
    if (override[k] !== undefined && override[k] !== null) out[k] = override[k];
  }
  return out;
}

// Resolve from a tenant row (System 1). Normalizes legacy tier names
// (basic/premium/pro → spark/beam/lighthouse) so DB rows don't need to
// migrate before the rename ships.
function fromTenant(tenant) {
  const rawTier = (tenant && tenant.tier) || 'spark';
  const tier = normalizeTier(rawTier);
  const base = getLimits(tier);
  const overrides = (tenant && tenant.settings && tenant.settings.limits) || null;
  const limits = deepMerge(base, overrides);
  return { tier, limits, source: 'tenant' };
}

// Resolve from a subscription row (System 2).
function fromSubscription(sub) {
  const plan = (sub && sub.plan) || 'lite';
  const tier = planToTier(plan);
  const base = getLimits(tier);
  // subscription.settings (JSONB) may also carry per-customer overrides.
  const overrides = (sub && sub.settings && sub.settings.limits) || null;
  const limits = deepMerge(base, overrides);
  return { tier, limits, plan, source: 'subscription' };
}

// Universal entry — caller passes whatever they have.
function resolve({ tenant, subscription } = {}) {
  if (tenant) return fromTenant(tenant);
  if (subscription) return fromSubscription(subscription);
  // No context at all — default to most-restrictive.
  return { tier: 'free', limits: getLimits('free'), source: 'default' };
}

module.exports = {
  resolve,
  fromTenant,
  fromSubscription,
};
