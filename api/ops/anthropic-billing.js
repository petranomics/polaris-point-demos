// /api/ops/anthropic-billing.js — Authoritative Anthropic spend, pulled from
// the org Admin API. This is what Anthropic actually billed, regardless of
// whether your local usage-logger captured it.
//
// Pair it with /api/ops/api-usage to spot silent log drops:
//   billed - logged = the gap your apps failed to record.
//
// Setup:
//   1. Console -> Settings -> Admin keys -> create key (org-scoped).
//   2. Add to Vercel env as ANTHROPIC_ADMIN_KEY (sk-ant-admin01-...).
//   3. Redeploy.
//
// Auth: matches sibling /api/ops/api-usage — open CORS, gated by /ops UI.
// Cache: 5 min in-memory (per cold start) so the dashboard doesn't hammer
// Anthropic on every refresh.

const ADMIN_BASE = 'https://api.anthropic.com/v1/organizations';
const VERSION = '2023-06-01';
const CACHE_TTL_MS = 5 * 60 * 1000;

// Per-cold-start cache. Vercel will spin new instances; that's fine — each
// gets its own 5-min cache and Anthropic's rate limits are generous.
let _cache = null;

const PRICING = {
  'claude-haiku-4-5':  { input: 1.00,  output: 5.00 },
  'claude-sonnet-4-6': { input: 3.00,  output: 15.00 },
  'claude-opus-4-7':   { input: 15.00, output: 75.00 },
};
const CACHE_WRITE_MULT_1H = 2;
const CACHE_READ_MULT = 0.1;

function rateFor(model) {
  if (!model) return null;
  const stripped = model.replace(/-\d{8}$/, '');
  if (PRICING[stripped]) return PRICING[stripped];
  if (PRICING[model]) return PRICING[model];
  if (model.includes('haiku')) return PRICING['claude-haiku-4-5'];
  if (model.includes('opus')) return PRICING['claude-opus-4-7'];
  if (model.includes('sonnet')) return PRICING['claude-sonnet-4-6'];
  return null;
}

function estimateCost({ model, uncached_input_tokens = 0, output_tokens = 0, cache_read_input_tokens = 0, cache_creation = {} }) {
  const r = rateFor(model);
  if (!r) return 0;
  const M = 1_000_000;
  const cw_1h = (cache_creation.ephemeral_1h_input_tokens || 0) * r.input * CACHE_WRITE_MULT_1H / M;
  const cw_5m = (cache_creation.ephemeral_5m_input_tokens || 0) * r.input * 1.25 / M;
  const cr = cache_read_input_tokens * r.input * CACHE_READ_MULT / M;
  const fresh = uncached_input_tokens * r.input / M;
  const out = output_tokens * r.output / M;
  return Number((fresh + cw_1h + cw_5m + cr + out).toFixed(6));
}

async function fetchAdmin(path, params, adminKey) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) v.forEach(x => qs.append(k, x));
    else if (v != null) qs.append(k, v);
  }
  const url = `${ADMIN_BASE}${path}?${qs.toString()}`;
  const resp = await fetch(url, {
    headers: { 'x-api-key': adminKey, 'anthropic-version': VERSION },
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Admin API ${path} ${resp.status}: ${body.slice(0, 300)}`);
  }
  return resp.json();
}

// Walk pagination — Admin API caps per-page; for ~14 days of buckets across
// a few group dimensions we usually fit in one page, but be safe.
async function fetchAllPages(path, params, adminKey, maxPages = 10) {
  const all = [];
  let page = null;
  for (let i = 0; i < maxPages; i++) {
    const body = await fetchAdmin(path, page ? { ...params, page } : params, adminKey);
    if (Array.isArray(body.data)) all.push(...body.data);
    if (!body.has_more || !body.next_page) break;
    page = body.next_page;
  }
  return all;
}

function startOfMonthUTC(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}
function daysAgoUTC(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const adminKey = process.env.ANTHROPIC_ADMIN_KEY;
  if (!adminKey) {
    return res.status(200).json({
      configured: false,
      hint: 'Set ANTHROPIC_ADMIN_KEY in Vercel env. Create at console.anthropic.com -> Settings -> Admin keys.',
    });
  }

  const force = req.query?.fresh === '1';
  if (!force && _cache && (Date.now() - _cache.ts) < CACHE_TTL_MS) {
    return res.status(200).json({ ..._cache.payload, cached: true, cache_age_ms: Date.now() - _cache.ts });
  }

  // 14 days covers MTD for the first half of the month and gives the chart room.
  // For later in the month, fall back to start-of-month (whichever is earlier).
  const monthStart = startOfMonthUTC();
  const fourteenAgo = daysAgoUTC(14);
  const startingAt = monthStart < fourteenAgo ? monthStart : fourteenAgo;

  try {
    const [costData, usageData] = await Promise.all([
      fetchAllPages('/cost_report', {
        starting_at: startingAt,
        bucket_width: '1d',
        'group_by[]': 'description',
        limit: 31,
      }, adminKey),
      fetchAllPages('/usage_report/messages', {
        starting_at: startingAt,
        bucket_width: '1d',
        'group_by[]': ['api_key_id', 'model'],
        limit: 31,
      }, adminKey),
    ]);

    // --- Cost: bucket -> sum cents -> USD ---
    const costByDay = {};
    let totalCostCents = 0;
    let mtdCostCents = 0;
    let last24hCostCents = 0;
    const monthStartTs = new Date(monthStart).getTime();
    const last24Ts = Date.now() - 24 * 3600 * 1000;

    for (const bucket of costData) {
      const day = bucket.starting_at?.slice(0, 10);
      const bucketStartTs = new Date(bucket.starting_at).getTime();
      const cents = (bucket.results || []).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
      totalCostCents += cents;
      if (bucketStartTs >= monthStartTs) mtdCostCents += cents;
      if (bucketStartTs >= last24Ts) last24hCostCents += cents;
      if (day) costByDay[day] = (costByDay[day] || 0) + cents;
    }

    const byDay = Object.entries(costByDay)
      .map(([day, cents]) => ({ day, cost_usd: cents / 100 }))
      .sort((a, b) => a.day.localeCompare(b.day));

    // --- Usage: roll up per api_key, per model (MTD only for the breakdown tables) ---
    const byKey = new Map();
    const byModel = new Map();
    for (const bucket of usageData) {
      const bucketStartTs = new Date(bucket.starting_at).getTime();
      if (bucketStartTs < monthStartTs) continue;
      for (const r of bucket.results || []) {
        const keyId = r.api_key_id || '(console/unknown)';
        const model = r.model || '(unknown)';
        const sample = {
          model,
          uncached_input_tokens: r.uncached_input_tokens || 0,
          output_tokens: r.output_tokens || 0,
          cache_read_input_tokens: r.cache_read_input_tokens || 0,
          cache_creation: r.cache_creation || {},
        };
        const cost = estimateCost(sample);
        const tokens = sample.uncached_input_tokens + sample.output_tokens
          + sample.cache_read_input_tokens
          + (sample.cache_creation.ephemeral_1h_input_tokens || 0)
          + (sample.cache_creation.ephemeral_5m_input_tokens || 0);

        const k = byKey.get(keyId) || { api_key_id: keyId, tokens: 0, estimated_cost_usd: 0, top_model: model };
        k.tokens += tokens;
        k.estimated_cost_usd += cost;
        byKey.set(keyId, k);

        const m = byModel.get(model) || {
          model, tokens: 0, estimated_cost_usd: 0,
          uncached_input: 0, output: 0, cache_read: 0,
        };
        m.tokens += tokens;
        m.estimated_cost_usd += cost;
        m.uncached_input += sample.uncached_input_tokens;
        m.output += sample.output_tokens;
        m.cache_read += sample.cache_read_input_tokens;
        byModel.set(model, m);
      }
    }

    const payload = {
      configured: true,
      generated_at: new Date().toISOString(),
      window: { starting_at: startingAt, ending_at: new Date().toISOString() },
      totals: {
        mtd_cost_usd: mtdCostCents / 100,
        last24h_cost_usd: last24hCostCents / 100,
        last14d_cost_usd: totalCostCents / 100,
      },
      by_day: byDay,
      by_api_key: [...byKey.values()]
        .map(k => ({ ...k, estimated_cost_usd: Number(k.estimated_cost_usd.toFixed(4)) }))
        .sort((a, b) => b.estimated_cost_usd - a.estimated_cost_usd),
      by_model: [...byModel.values()]
        .map(m => ({ ...m, estimated_cost_usd: Number(m.estimated_cost_usd.toFixed(4)) }))
        .sort((a, b) => b.estimated_cost_usd - a.estimated_cost_usd),
    };
    _cache = { ts: Date.now(), payload };
    return res.status(200).json(payload);
  } catch (err) {
    console.error('anthropic-billing error', err);
    return res.status(500).json({ configured: true, error: err.message || 'Admin API request failed' });
  }
};
