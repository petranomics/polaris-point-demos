#!/usr/bin/env node
// spend-review.cjs — Compares current Anthropic spend against the 2026-05-14
// baseline captured right after the beacons/offtrailed cost-reduction work.
//
// Run by cron (see scripts/install-spend-review-cron.sh).
// Writes a markdown report to ~/Library/Logs/polaris-spend-review.log and
// fires a macOS notification when finished.
//
// To pause:    crontab -l | grep -v spend-review.cjs | crontab -
// To re-run:   node scripts/spend-review.cjs

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(REPO_ROOT, '.env.local');
const LOG_PATH = path.join(process.env.HOME, 'Library', 'Logs', 'polaris-spend-review.log');

// Baseline captured 2026-05-14 (last-7-days snapshot from beacons_usage_log)
const BASELINE = {
  captured_at: '2026-05-14',
  description: 'Baseline taken AFTER the May 4 offtrailed Haiku swap but BEFORE the May 10 beacons web_search cap took effect for a full 7-day window.',
  by_app_7d: [
    { app: 'beacons',       calls: 14, cost_usd: 2.5246 },
    { app: 'offtrailed',    calls: 3,  cost_usd: 0.8830 },
    { app: 'polaris-point', calls: 25, cost_usd: 0.0222 },
    { app: 'armadillo',     calls: 1,  cost_usd: 0.0114 },
    { app: 'polostew',      calls: 3,  cost_usd: 0.0022 },
  ],
  beacons_chat: {
    calls: 11,
    cost_usd: 2.4728,
    web_searches_total: 150,
    avg_searches_per_call: 13.6,
    avg_cost_per_call: 0.2248,
    cache_read_input_tokens_total: 0, // base system block wasn't cached pre-May-10
  },
  offtrailed_7d: {
    calls: 3,
    web_searches: 26,
    cost_usd: 0.8830,
    avg_cost_per_call: 0.2943,
    model: 'claude-haiku-4-5-20251001', // Sonnet → Haiku swap shipped May 4
  },
  success_criteria: [
    'beacons /api/beacons/chat avg cost per call ≤ $0.08 (was $0.22)',
    'beacons /api/beacons/chat avg web_searches per call ≤ 4 (cap is 4 per turn, was ~13.6)',
    'cache_read_input_tokens > 0 on ≥ 50% of beacons chat calls (proves caching works)',
    'offtrailed model stays haiku-4-5; no Sonnet rows',
    'Total 7-day Anthropic spend ≤ $1.50 (was $3.44)',
  ],
};

function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) {
    throw new Error(`.env.local not found at ${ENV_PATH}`);
  }
  const raw = fs.readFileSync(ENV_PATH, 'utf8');
  raw.split('\n').forEach((line) => {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (!m) return;
    let val = m[2];
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    process.env[m[1]] = val;
  });
}

function notify(title, message) {
  try {
    const safeTitle = String(title).replace(/"/g, '\\"');
    const safeMsg = String(message).replace(/"/g, '\\"').slice(0, 200);
    execSync(`osascript -e 'display notification "${safeMsg}" with title "${safeTitle}"'`, { stdio: 'ignore' });
  } catch (_) {
    // macOS notification failed (sandboxed cron, etc.) — log-only is fine
  }
}

function fmtUsd(n) {
  return '$' + Number(n || 0).toFixed(4);
}

function appendLog(text) {
  const sep = '\n' + '='.repeat(72) + '\n';
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  fs.appendFileSync(LOG_PATH, sep + text + '\n');
}

async function runReview() {
  loadEnv();
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL missing from .env.local');
  }

  const { neon } = require(path.join(REPO_ROOT, 'node_modules', '@neondatabase', 'serverless'));
  const sql = neon(process.env.DATABASE_URL);

  // ---------- queries ----------
  const byApp = await sql`
    SELECT COALESCE(app, '(none)') AS app,
           COUNT(*) AS calls,
           SUM(cost_usd)::numeric(10,4) AS cost_usd
    FROM beacons_usage_log
    WHERE created_at > NOW() - INTERVAL '7 days' AND provider = 'anthropic'
    GROUP BY app
    ORDER BY cost_usd DESC NULLS LAST`;

  const beaconsChat = await sql`
    SELECT COUNT(*) AS calls,
           SUM(input_tokens) AS in_tok,
           SUM(output_tokens) AS out_tok,
           SUM(web_searches) AS web_searches,
           SUM(cache_read_tokens) AS cache_read,
           SUM(cache_creation_tokens) AS cache_write,
           SUM(CASE WHEN cache_read_tokens > 0 THEN 1 ELSE 0 END) AS calls_with_cache_hit,
           SUM(cost_usd)::numeric(10,4) AS cost_usd
    FROM beacons_usage_log
    WHERE created_at > NOW() - INTERVAL '7 days'
      AND provider = 'anthropic'
      AND app = 'beacons'
      AND endpoint = '/api/beacons/chat'`;

  const offtrailed = await sql`
    SELECT model,
           COUNT(*) AS calls,
           SUM(web_searches) AS web_searches,
           SUM(cost_usd)::numeric(10,4) AS cost_usd
    FROM beacons_usage_log
    WHERE created_at > NOW() - INTERVAL '7 days'
      AND provider = 'anthropic'
      AND app = 'offtrailed'
    GROUP BY model
    ORDER BY cost_usd DESC NULLS LAST`;

  // ---------- compare ----------
  const totalCost7d = byApp.reduce((s, r) => s + Number(r.cost_usd || 0), 0);
  const baselineTotal = BASELINE.by_app_7d.reduce((s, r) => s + r.cost_usd, 0);

  const bc = beaconsChat[0] || {};
  const avgCostPerCall = bc.calls > 0 ? Number(bc.cost_usd) / Number(bc.calls) : 0;
  const avgSearchesPerCall = bc.calls > 0 ? Number(bc.web_searches || 0) / Number(bc.calls) : 0;
  const cacheHitRate = bc.calls > 0 ? Number(bc.calls_with_cache_hit) / Number(bc.calls) : 0;

  const offHasSonnet = offtrailed.some((r) => /sonnet/i.test(r.model || ''));

  // ---------- pass/fail per criterion ----------
  const checks = [
    {
      name: 'beacons chat avg cost per call ≤ $0.08',
      baseline: fmtUsd(BASELINE.beacons_chat.avg_cost_per_call),
      current: fmtUsd(avgCostPerCall),
      pass: avgCostPerCall <= 0.08,
    },
    {
      name: 'beacons chat avg web_searches per call ≤ 4',
      baseline: BASELINE.beacons_chat.avg_searches_per_call.toFixed(1),
      current: avgSearchesPerCall.toFixed(1),
      pass: avgSearchesPerCall <= 4,
    },
    {
      name: 'cache_read tokens > 0 on ≥ 50% of beacons chat calls',
      baseline: '0%',
      current: (cacheHitRate * 100).toFixed(0) + '%',
      pass: cacheHitRate >= 0.5,
    },
    {
      name: 'offtrailed model is Haiku (no Sonnet rows)',
      baseline: 'Haiku',
      current: offHasSonnet ? 'Sonnet present' : (offtrailed[0]?.model || 'no calls'),
      pass: !offHasSonnet,
    },
    {
      name: 'Total 7-day Anthropic spend ≤ $1.50',
      baseline: fmtUsd(baselineTotal),
      current: fmtUsd(totalCost7d),
      pass: totalCost7d <= 1.5,
    },
  ];

  // ---------- build report ----------
  const passCount = checks.filter((c) => c.pass).length;
  const totalChecks = checks.length;

  const lines = [];
  lines.push(`# Polaris Point spend review — ${new Date().toISOString().slice(0, 10)}`);
  lines.push('');
  lines.push(`**Result: ${passCount}/${totalChecks} success criteria passed.**`);
  lines.push('');
  lines.push('## Pass/fail');
  lines.push('');
  lines.push('| # | Criterion | Baseline | Current | Pass? |');
  lines.push('|---|---|---|---|---|');
  checks.forEach((c, i) => {
    lines.push(`| ${i + 1} | ${c.name} | ${c.baseline} | ${c.current} | ${c.pass ? '✅' : '❌'} |`);
  });
  lines.push('');
  lines.push('## Current 7-day spend by app');
  lines.push('');
  lines.push('| App | Calls | Cost (USD) |');
  lines.push('|---|---|---|');
  byApp.forEach((r) => {
    lines.push(`| ${r.app} | ${r.calls} | ${fmtUsd(r.cost_usd)} |`);
  });
  lines.push(`| **Total** | — | **${fmtUsd(totalCost7d)}** |`);
  lines.push('');
  lines.push('## Beacons /api/beacons/chat detail');
  lines.push('');
  lines.push(`- Calls: ${bc.calls || 0}`);
  lines.push(`- Cost: ${fmtUsd(bc.cost_usd)}`);
  lines.push(`- Avg cost/call: ${fmtUsd(avgCostPerCall)}`);
  lines.push(`- Web searches total: ${bc.web_searches || 0}`);
  lines.push(`- Avg searches/call: ${avgSearchesPerCall.toFixed(1)}`);
  lines.push(`- Cache reads total: ${bc.cache_read || 0} tokens`);
  lines.push(`- Cache hit rate: ${(cacheHitRate * 100).toFixed(0)}% of calls`);
  lines.push('');
  lines.push('## Offtrailed detail');
  lines.push('');
  if (offtrailed.length === 0) {
    lines.push('No offtrailed calls in last 7 days.');
  } else {
    lines.push('| Model | Calls | Web searches | Cost |');
    lines.push('|---|---|---|---|');
    offtrailed.forEach((r) => {
      lines.push(`| ${r.model} | ${r.calls} | ${r.web_searches} | ${fmtUsd(r.cost_usd)} |`);
    });
  }
  lines.push('');
  lines.push('## Next steps');
  lines.push('');
  if (passCount === totalChecks) {
    lines.push('All criteria pass. Consider removing the cron entry (`crontab -e`) since the work is verified.');
  } else {
    const failing = checks.filter((c) => !c.pass).map((c) => `- ${c.name}: ${c.current} (baseline ${c.baseline})`);
    lines.push('Failing criteria:');
    lines.push(...failing);
    lines.push('');
    lines.push('Open the session memory for context (`feedback_followup_persistence`, `project_*_spend*`).');
  }

  const report = lines.join('\n');
  appendLog(report);

  const summary = `${passCount}/${totalChecks} criteria pass — total 7d spend ${fmtUsd(totalCost7d)}`;
  console.log(report);
  notify('Polaris Point spend review', summary);
}

runReview().catch((err) => {
  const msg = err && err.message ? err.message : String(err);
  let hint = '';
  if (/not allowed to connect/i.test(msg)) {
    hint = ' — Neon IP allowlist needs your current IP added at console.neon.tech';
  } else if (/ENOTFOUND|ETIMEDOUT/i.test(msg)) {
    hint = ' — network failure, check connectivity';
  }
  const errReport = `# Polaris Point spend review — FAILED — ${new Date().toISOString()}\n\nError: ${msg}${hint}\n`;
  console.error(errReport);
  appendLog(errReport);
  notify('Polaris Point spend review FAILED', msg.slice(0, 180) + hint);
  process.exit(1);
});
