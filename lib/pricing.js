// /lib/pricing.js — Anthropic API rate constants + usage logging.
//
// Per-million-token rates as of mid-2025. Cache pricing follows Anthropic's
// extended TTL pricing: 1h cache writes are 2x input, reads are 0.1x input.
// Web search is a flat $0.01 per use.
//
// Centralized so when rates shift you change one file. Schema is multi-user
// ready (user_id column nullable, indexed) — drop in user IDs when you scale.

const PRICING = {
  'claude-haiku-4-5':   { input: 1.00,  output: 5.00 },
  'claude-sonnet-4-6':  { input: 3.00,  output: 15.00 },
  'claude-opus-4-7':    { input: 15.00, output: 75.00 }
};
const WEB_SEARCH_PRICE_USD = 0.01;
const CACHE_WRITE_MULT_1H = 2;
const CACHE_READ_MULT = 0.1;

function findRate(model) {
  if (!model) return PRICING['claude-haiku-4-5'];
  // Strip Anthropic's dated suffix (e.g., '-20251001')
  const stripped = model.replace(/-\d{8}$/, '');
  if (PRICING[stripped]) return PRICING[stripped];
  if (PRICING[model]) return PRICING[model];
  if (model.includes('haiku')) return PRICING['claude-haiku-4-5'];
  if (model.includes('opus')) return PRICING['claude-opus-4-7'];
  if (model.includes('sonnet')) return PRICING['claude-sonnet-4-6'];
  return PRICING['claude-haiku-4-5'];
}

function computeCost({ model, inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens, webSearches }) {
  const r = findRate(model);
  const M = 1_000_000;
  const fresh = (inputTokens || 0) * r.input / M;
  const cw = (cacheCreationTokens || 0) * r.input * CACHE_WRITE_MULT_1H / M;
  const cr = (cacheReadTokens || 0) * r.input * CACHE_READ_MULT / M;
  const out = (outputTokens || 0) * r.output / M;
  const search = (webSearches || 0) * WEB_SEARCH_PRICE_USD;
  return Number((fresh + cw + cr + out + search).toFixed(6));
}

async function ensureUsageTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS beacons_usage_log (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT,
      model TEXT,
      mode TEXT,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
      cache_read_tokens INTEGER NOT NULL DEFAULT 0,
      web_searches INTEGER NOT NULL DEFAULT 0,
      cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  // Unified multi-app columns (additive — see sql/2026-05-02-unified-usage-log.sql).
  await sql`ALTER TABLE beacons_usage_log ADD COLUMN IF NOT EXISTS app        TEXT`;
  await sql`ALTER TABLE beacons_usage_log ADD COLUMN IF NOT EXISTS endpoint   TEXT`;
  await sql`ALTER TABLE beacons_usage_log ADD COLUMN IF NOT EXISTS provider   TEXT`;
  await sql`ALTER TABLE beacons_usage_log ADD COLUMN IF NOT EXISTS tenant_id  TEXT`;
  await sql`ALTER TABLE beacons_usage_log ADD COLUMN IF NOT EXISTS latency_ms INTEGER`;
  await sql`ALTER TABLE beacons_usage_log ADD COLUMN IF NOT EXISTS metadata   JSONB`;
  await sql`CREATE INDEX IF NOT EXISTS idx_beacons_usage_log_created  ON beacons_usage_log (created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_beacons_usage_log_user     ON beacons_usage_log (user_id, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_usage_log_app              ON beacons_usage_log (app, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_usage_log_tenant           ON beacons_usage_log (tenant_id, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_usage_log_provider         ON beacons_usage_log (provider, created_at DESC)`;
}

async function logUsage(sql, opts) {
  const {
    userId, model, mode, usage, webSearches,
    app, endpoint, tenant, provider, latencyMs, metadata
  } = opts || {};
  const u = usage || {};
  const inputTokens = u.input_tokens || 0;
  const outputTokens = u.output_tokens || 0;
  // Anthropic sometimes nests cache_creation under a model variant — accept both.
  const cacheCreation =
    u.cache_creation_input_tokens ||
    (u.cache_creation && (u.cache_creation['1h_input_tokens'] || u.cache_creation['5m_input_tokens'])) ||
    0;
  const cacheRead = u.cache_read_input_tokens || 0;
  const webSearchCount = webSearches || 0;
  const prov = provider || 'anthropic';
  const costUsd = prov === 'anthropic' ? computeCost({
    model,
    inputTokens,
    outputTokens,
    cacheCreationTokens: cacheCreation,
    cacheReadTokens: cacheRead,
    webSearches: webSearchCount
  }) : 0;
  await sql`
    INSERT INTO beacons_usage_log (
      app, endpoint, tenant_id, user_id, provider, model, mode,
      input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens,
      web_searches, cost_usd, latency_ms, metadata
    )
    VALUES (
      ${app || 'beacons'}, ${endpoint || null}, ${tenant || userId || null},
      ${userId || tenant || null}, ${prov}, ${model || null}, ${mode || null},
      ${inputTokens}, ${outputTokens},
      ${cacheCreation}, ${cacheRead}, ${webSearchCount}, ${costUsd},
      ${latencyMs || null},
      ${metadata ? JSON.stringify(metadata) : null}
    )
  `;
  return costUsd;
}

function monthlyLimit() {
  const env = parseFloat(process.env.BEACONS_MONTHLY_LIMIT_USD || '50');
  return isFinite(env) && env > 0 ? env : 50;
}

module.exports = {
  PRICING,
  WEB_SEARCH_PRICE_USD,
  findRate,
  computeCost,
  ensureUsageTable,
  logUsage,
  monthlyLimit
};
