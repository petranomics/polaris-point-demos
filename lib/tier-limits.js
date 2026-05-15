// /lib/tier-limits.js — Per-tier dial table. Single source of truth for
// what each plan can use. Hot-editable: change a number, change the world.
//
// Tiers map to:
//   beacons_tenants.tier (System 1 — direct polarispoint.io/beacon users)
//   beacon_subscriptions.plan via PLAN_TIER_MAP (System 2 — branded SMB widgets)
//
// Limits:
//   rag_tokens         — max library tokens passed as context per query
//   max_output         — max tokens Beacon can produce in one response
//   history            — max conversation turns kept (older get summarized)
//   web_search         — max web searches Beacon can use per turn
//   inquiries_mo       — max chats per calendar month (null = unlimited)
//   recurring_day      — max recurring tasks runnable per day (null = unlimited)
//   library_mb         — max library storage in MB (null = unlimited)
//
// Resolution order at request time (see lib/resolve-tier.js):
//   tenant.settings.limits (per-customer JSONB override)
//     → fall back to TIER_LIMITS[tier]
//     → fall back to TIER_LIMITS.basic (defensive default)

const TIER_LIMITS = {
  free: {
    rag_tokens:    0,       // no library access — bring your own context per query
    max_output:    800,
    history:       3,
    web_search:    0,
    inquiries_mo:  20,
    recurring_day: 0,
    library_mb:    10,
  },
  basic: {
    rag_tokens:    8000,
    max_output:    1500,
    history:       5,
    web_search:    2,
    inquiries_mo:  200,
    recurring_day: 2,
    library_mb:    50,
  },
  premium: {
    rag_tokens:    15000,
    max_output:    3000,
    history:       12,
    web_search:    4,
    inquiries_mo:  1500,
    recurring_day: 5,
    library_mb:    250,
  },
  pro: {
    rag_tokens:    30000,
    max_output:    6000,
    history:       20,
    web_search:    8,
    inquiries_mo:  null,
    recurring_day: 15,
    library_mb:    1024,
  },
  // Internal — Pete and admin users. Effectively unlimited.
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

// System 2 (beacon_subscriptions) uses different plan names. Map them to
// the same tier semantics so both systems share one set of dials.
const PLAN_TIER_MAP = {
  lite:    'basic',
  beacon:  'premium',
  pro:     'pro',
  // Anything unrecognized defaults to 'basic' in resolveTier.
};

function getLimits(tier) {
  return TIER_LIMITS[tier] || TIER_LIMITS.basic;
}

function planToTier(plan) {
  return PLAN_TIER_MAP[plan] || 'basic';
}

module.exports = {
  TIER_LIMITS,
  PLAN_TIER_MAP,
  getLimits,
  planToTier,
};
