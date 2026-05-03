// /lib/usage-logger.cjs — Unified API usage logger (CommonJS).
//
// Same shape as lib/usage-logger.mjs. Use this in CJS endpoints to avoid
// having to plumb a sql connection through every call site.
//
// Usage:
//   const { logUsage } = require('../../lib/usage-logger.cjs');
//   const t0 = Date.now();
//   const data = await fetch(...).then(r => r.json());
//   await logUsage({
//     app: 'beacons',
//     endpoint: '/api/generate',
//     model: 'claude-haiku-4-5-20251001',
//     provider: 'anthropic',
//     response: data,
//     latencyMs: Date.now() - t0,
//   });

const { neon } = require('@neondatabase/serverless');
const Pricing = require('./pricing');

async function logUsage(opts) {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.warn('[usage-logger] DATABASE_URL not set, skipping log');
    return null;
  }
  try {
    const sql = neon(dbUrl);
    // Lazy-ensure schema once per cold start. ensureUsageTable is idempotent.
    if (!logUsage._schemaEnsured) {
      await Pricing.ensureUsageTable(sql);
      logUsage._schemaEnsured = true;
    }
    const u = opts.response?.usage || opts.usage || {};
    return await Pricing.logUsage(sql, {
      app:        opts.app,
      endpoint:   opts.endpoint,
      tenant:     opts.tenant,
      userId:     opts.userId || opts.tenant || null,
      model:      opts.model,
      provider:   opts.provider || 'anthropic',
      mode:       opts.mode,
      usage:      u,
      webSearches: opts.webSearches || 0,
      latencyMs:  opts.latencyMs,
      metadata:   opts.metadata,
    });
  } catch (err) {
    console.warn('[usage-logger] log failed (non-fatal):', err?.message || err);
    return null;
  }
}

module.exports = { logUsage };
