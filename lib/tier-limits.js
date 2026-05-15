// /lib/tier-limits.js — Per-tier dial table. Single source of truth for
// what each plan can use. Hot-editable: change a number, change the world.
//
// Tier names follow the Beacon lighthouse brand:
//   spark      — entry ($129 / $99 6-mo)
//   beam       — mid   ($249 / $199 6-mo)
//   lighthouse — top   ($499 / $399 6-mo)
//   free       — pre-paid trial
//   pete       — internal/admin (effectively unlimited)
//
// Legacy names (basic/premium/pro) auto-map to the new ones in getLimits()
// for backward compat — existing DB rows continue working until migrated.
//
// Limits:
//   rag_tokens, max_output, history, web_search, inquiries_mo,
//   recurring_day, library_mb
//
// Resolution order at request time (see lib/resolve-tier.js):
//   tenant.settings.limits  (per-customer JSONB override)
//     → fall back to TIER_LIMITS[tier]
//     → fall back to TIER_LIMITS.spark  (defensive default)

const TIER_LIMITS = {
  free: {
    rag_tokens:    0,
    max_output:    800,
    history:       3,
    web_search:    0,
    inquiries_mo:  20,
    recurring_day: 0,
    library_mb:    10,
  },
  spark: {
    rag_tokens:    8000,
    max_output:    1500,
    history:       5,
    web_search:    2,
    inquiries_mo:  200,
    recurring_day: 2,
    library_mb:    50,
  },
  beam: {
    rag_tokens:    15000,
    max_output:    3000,
    history:       12,
    web_search:    4,
    inquiries_mo:  1500,
    recurring_day: 5,
    library_mb:    250,
  },
  lighthouse: {
    rag_tokens:    30000,
    max_output:    6000,
    history:       20,
    web_search:    8,
    inquiries_mo:  null,
    recurring_day: 15,
    library_mb:    1024,
  },
  pete: {
    rag_tokens:    999999,
    max_output:    8000,
    history:       30,
    web_search:    10,
    inquiries_mo:  null,
    recurring_day: null,
    library_mb:    null,
  },
};

// Legacy tier names → new lighthouse-themed names. Lets us rename without
// breaking existing rows. Deprecated names removed when DB is fully migrated.
const LEGACY_TIER_ALIASES = {
  basic:   'spark',
  premium: 'beam',
  pro:     'lighthouse',
};

// System 2 (beacon_subscriptions) plan names → tier.
const PLAN_TIER_MAP = {
  lite:       'spark',
  beacon:     'beam',
  spark:      'spark',
  beam:       'beam',
  lighthouse: 'lighthouse',
  pro:        'lighthouse', // historical
};

// Display labels — what we show to users (capitalized + branded).
const TIER_LABELS = {
  free:       'Free trial',
  spark:      'Spark',
  beam:       'Beam',
  lighthouse: 'Lighthouse',
  pete:       'Admin',
};

// Pricing (USD per month). Used by the plan portal UI.
const TIER_PRICING = {
  spark:      { monthly: 129, sixMonth: 99 },
  beam:       { monthly: 249, sixMonth: 199 },
  lighthouse: { monthly: 499, sixMonth: 399 },
};

function normalizeTier(tier) {
  if (!tier) return 'spark';
  return LEGACY_TIER_ALIASES[tier] || tier;
}

function getLimits(tier) {
  const t = normalizeTier(tier);
  return TIER_LIMITS[t] || TIER_LIMITS.spark;
}

function planToTier(plan) {
  return PLAN_TIER_MAP[plan] || 'spark';
}

function labelFor(tier) {
  return TIER_LABELS[normalizeTier(tier)] || 'Spark';
}

module.exports = {
  TIER_LIMITS,
  PLAN_TIER_MAP,
  TIER_LABELS,
  TIER_PRICING,
  LEGACY_TIER_ALIASES,
  getLimits,
  planToTier,
  normalizeTier,
  labelFor,
};
