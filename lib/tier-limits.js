// /lib/tier-limits.js — Per-tier dial table. Single source of truth for
// what each plan can use AND what it costs. Hot-editable: change a number,
// change the world (app, admin, marketing all read from here via the
// /api/beacons/pricing endpoint).
//
// Tier names follow the Beacon lighthouse brand:
//   spark      — entry ($129 / $89 6-mo  — 31% off committed)
//   beam       — mid   ($249 / $179 6-mo — 28% off committed)
//   lighthouse — top   ($499 / $359 6-mo — 28% off committed)
//   free       — pre-paid trial
//   pete       — internal/admin (never charged, never shown to customers)
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

// Pricing (USD per month). Used by the plan portal UI, marketing pages,
// and the admin offers page. The features list per tier is rendered into
// pricing cards everywhere — keep edits here only.
const TIER_PRICING = {
  spark:      { monthly: 129, sixMonth:  89, tagline: 'For solo operators getting started' },
  beam:       { monthly: 249, sixMonth: 179, tagline: 'For working professionals running multiple projects' },
  lighthouse: { monthly: 499, sixMonth: 359, tagline: 'For agencies and power users' },
};

// Customer-facing feature bullets per tier. Order matters — first item is
// the headline differentiator. Inherited tiers should mention "Everything in X".
const TIER_FEATURES = {
  spark: [
    '8K context per chat',
    '5-turn memory',
    '200 inquiries/month',
    '50 MB library',
    '2 web searches per turn',
    'Default Haiku model',
  ],
  beam: [
    'Everything in Spark',
    '15K context per chat',
    '12-turn memory',
    '1,500 inquiries/month',
    '250 MB library',
    'Sonnet auto-upgrade on key drafts',
  ],
  lighthouse: [
    'Everything in Beam',
    '30K context per chat',
    '20-turn memory',
    'Unlimited inquiries',
    '1 GB library',
    'Sonnet by default · Opus on demand',
  ],
};

// Display order for any UI rendering all paid tiers.
const TIER_ORDER = ['spark', 'beam', 'lighthouse'];

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
  TIER_FEATURES,
  TIER_ORDER,
  LEGACY_TIER_ALIASES,
  getLimits,
  planToTier,
  normalizeTier,
  labelFor,
};
