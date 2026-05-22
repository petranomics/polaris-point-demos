// /lib/services-pricing.js — Polaris Point Services pricing.
//
// Single source of truth for everything outside the Beacon SaaS tiers (those
// live in lib/tier-limits.js). Covers:
//   - One-time website builds (Starter/Growth/Pro)
//   - The monthly RECURRING LADDER — every tier supersedes the previous, so
//     a customer never pays for two tiers at once. Hosting is the floor;
//     Beacon (any tier) is the ceiling and includes everything below it.
//   - Add-on services (SEO, ads, brand, etc.) sold separately or in bundles
//   - The three packaged bundles reps lead with
//
// Edit here when prices change. Marketing pages and admin should render from
// /api/beacons/services-pricing (TODO endpoint) or be kept in sync by the
// "keep aligned with lib/services-pricing.js" code comment pattern.

const BUILDS = {
  starter: {
    name: 'Starter',
    oneTime: 799,
    tagline: 'Get online, look professional',
    features: [
      '5 pages, mobile responsive',
      'Contact form & CTAs',
      'Google Business Profile setup',
      'Basic SEO + AI-generated content',
      '2-week launch window',
    ],
  },
  growth: {
    name: 'Growth',
    oneTime: 1299,
    tagline: 'For service businesses ready to grow',
    features: [
      'Everything in Starter',
      'Blog + photo gallery',
      'Lead capture + GA4 + Search Console',
      'Monthly minor edits',
      'Dedicated service pages',
    ],
  },
  pro: {
    name: 'Pro',
    oneTime: 2499,
    tagline: 'Full-featured custom build',
    features: [
      'Everything in Growth',
      'Fully custom design + branding',
      'Multi-location support',
      'Advanced schema + integrations',
      'Quarterly SEO report + priority support',
    ],
  },
};

// Monthly recurring ladder. Each tier strictly supersedes the previous —
// pick one, that's your single recurring line. Beacon tiers come from
// lib/tier-limits.js (TIER_PRICING) and add their content/marketing AI on
// top of everything in Business Automation.
const LADDER = {
  hosting: {
    name: 'Hosting & Analytics',
    monthly: 25,
    tagline: 'The floor — every customer needs this',
    features: [
      'Site hosting + CDN',
      'Uptime monitoring',
      'Visitor analytics',
      'Monthly performance report',
    ],
  },
  automation: {
    name: 'Business Automation',
    monthly: 79,
    tagline: 'Add the tools that turn a site into a business',
    features: [
      'Everything in Hosting & Analytics',
      'Online booking widget (Calendly embed)',
      'AI popup chat — answers from your site content',
      'Lead capture + instant auto-reply email',
      'Automated review-request emails after service',
    ],
  },
  // Beacon Spark / Beam / Lighthouse come next — see lib/tier-limits.js for
  // their canonical pricing + features. The ladder presents Beacon as the
  // top tiers; Beacon includes everything in Hosting + Automation by design.
};

// SEO, Paid Ads, and one-off Services sold as add-ons to any tier.
const ADD_ONS = {
  gbp_optimization:     { name: 'GBP Optimization',                price: 199,  unit: 'one-time' },
  local_seo:            { name: 'Local SEO Retainer',              price: 499,  unit: '/mo' },
  multi_location_seo:   { name: 'Multi-location SEO (up to 5)',    price: 899,  unit: '/mo' },
  google_lsa:           { name: 'Google Local Service Ads',        price: 750,  unit: 'setup', recurring: '15% of spend (min $500/mo)' },
  google_search_ads:    { name: 'Google Search Ads',               price: 1500, unit: 'setup', recurring: '15% of spend (min $750/mo)' },
  meta_ads:             { name: 'Meta Ads (FB/IG)',                price: 1500, unit: 'setup', recurring: '15% of spend (min $750/mo)' },
  full_funnel_ads:      { name: 'Full Funnel (Google + Meta)',     price: 3000, unit: 'setup', recurring: '15% of spend (min $1,500/mo)' },
  logo:                 { name: 'Logo design',                     price: 499,  unit: 'one-time' },
  brand_guide:          { name: 'Brand guide',                     price: 799,  unit: 'one-time' },
  promo_video:          { name: 'Promotional video (60–90s)',      price: 1499, unit: 'one-time' },
  photography:          { name: 'Photography (half-day, Austin)',  price: 899,  unit: 'one-time' },
  email_migration:      { name: 'Email migration (Google Workspace)', price: 299, unit: 'per-domain' },
  blog_retainer:        { name: 'Monthly content retainer (4 posts)', price: 599, unit: '/mo' },
};

// Bundles reps lead with. Each bundle resolves into:
//   - One build tier (one-time)
//   - One ladder tier (recurring, supersedes lower ladder rungs)
//   - Optional add-ons (each adds to recurring)
// Bundle pricing is roughly 10% off line-item total. Pete approves deeper discounts.
const BUNDLES = {
  foundation: {
    name: 'Foundation',
    tagline: 'Entry — get online with the tools to capture leads',
    build: 'starter',                    // $799 one-time
    ladder: 'automation',                // $79/mo (includes hosting)
    add_ons: [],                         // none
    setup_total: 799,
    recurring_total: 79,
    pitch: 'For the business getting online for the first time. Site + booking + AI chat + auto lead reply.',
  },
  momentum: {
    name: 'Momentum — most popular',
    tagline: 'Growth + Beacon content engine + local SEO',
    build: 'growth',                     // $1,299 one-time
    ladder: 'beam_6mo',                  // $179/mo on 6-mo commit (Beam from tier-limits.js; supersedes Automation)
    add_ons: ['local_seo'],              // $499/mo
    setup_total: 1299,
    recurring_total: 678,                // 179 + 499
    pitch: 'For service businesses ready to grow. Pro-grade content engine + SEO retainer — most clients land here.',
  },
  accelerator: {
    name: 'Accelerator',
    tagline: 'Full-stack: top-tier Beacon + SEO + paid ads',
    build: 'pro',                        // $2,499 one-time
    ladder: 'lighthouse_6mo',            // $359/mo on 6-mo commit (Lighthouse from tier-limits.js)
    add_ons: ['local_seo', 'google_search_ads'],
    setup_total: 4500,                   // includes Pro build + Search Ads setup + extras (round)
    recurring_total: 858,                // 359 + 499
    recurring_plus: 'ad spend',          // pass-through to Google
    pitch: 'For businesses ready to scale. Every tool, white-glove. Recurring excludes ad spend (pass-through to Google).',
  },
};

// What we do NOT sell — keep here so sales reps and the AI both honor it.
const NOT_SOLD = [
  'Print / direct mail',
  'Billboards or radio',
  'TV ads',
  'Trade show booths or event marketing',
  'App development (mobile native)',
  'Hardware (POS systems, kiosks)',
  'Bookkeeping, payroll, HR',
];

module.exports = {
  BUILDS,
  LADDER,
  ADD_ONS,
  BUNDLES,
  NOT_SOLD,
};
