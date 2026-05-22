// /api/beacons/pricing.js — Public canonical pricing.
//
// GET → JSON shape:
//   {
//     order:  ['spark', 'beam', 'lighthouse'],
//     tiers: {
//       spark:      { name, monthly, sixMonth, sixMonthDiscountPct, tagline, features: [...] },
//       beam:       { ... },
//       lighthouse: { ... }
//     }
//   }
//
// Read from lib/tier-limits.js so app + admin + marketing never drift.
// No auth required — pricing is public information.

const { TIER_PRICING, TIER_FEATURES, TIER_LABELS, TIER_ORDER } = require('../../lib/tier-limits');

module.exports = function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const tiers = {};
  for (const key of TIER_ORDER) {
    const p = TIER_PRICING[key];
    const discountPct = Math.round(((p.monthly - p.sixMonth) / p.monthly) * 100);
    tiers[key] = {
      name: TIER_LABELS[key] || key,
      monthly: p.monthly,
      sixMonth: p.sixMonth,
      sixMonthDiscountPct: discountPct,
      tagline: p.tagline || '',
      features: TIER_FEATURES[key] || [],
    };
  }
  // Five-minute browser cache — pricing changes rarely; this keeps the call
  // off the hot path for repeat page loads without hiding edits for long.
  res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
  return res.status(200).json({ order: TIER_ORDER, tiers });
};
