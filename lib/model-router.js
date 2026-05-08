// /lib/model-router.js — Triage requests to the right model + provider.
//
// Inputs:  { task, tenant, budgetLeftPct, mode? }
// Output:  { provider, model, reason, fallback }
//
// Providers:
//   'anthropic' — direct Anthropic API. Uses ANTHROPIC_API_KEY.
//   'ollama'    — local LLM via Cloudflare Tunnel on Pete's Mac mini.
//                 Active only when OLLAMA_BASE_URL env is set.
//
// Models (Anthropic):
//   claude-haiku-4-5    — cheap, fast (default for most chat)
//   claude-sonnet-4-6   — mid (research, multi-step, premium chat)
//   claude-opus-4-7     — high reasoning (premium-tier-only by default)
//
// Models (Ollama):
//   mistral             — default local model
//   llama3.1            — alternative if Pete has it pulled
//
// Tasks:
//   'chat'      — generic chat turn (default)
//   'draft'     — outreach draft, summary, simple text generation (Ollama-friendly)
//   'summary'   — same as draft (collapsed for clarity)
//   'research'  — needs web_search and reasoning over results
//   'complex'   — long-form, multi-step reasoning (premium tier only)
//
// The router emits a `reason` string explaining the choice, useful for
// logging/debugging in beacons_usage_log.metadata.

const TASK_ALIASES = { summary: 'draft', summarize: 'draft', email: 'draft' };

function ollamaEnabled() {
  return !!(process.env.OLLAMA_BASE_URL || '').trim();
}

function pick(provider, model, reason, fallback) {
  return { provider, model, reason, fallback: fallback || null };
}

// Tier capabilities — central source of truth for what each plan can use.
const TIER_CAPS = {
  pete:    { allow_opus: true,  allow_sonnet: true,  allow_haiku: true,  allow_ollama: true },
  premium: { allow_opus: true,  allow_sonnet: true,  allow_haiku: true,  allow_ollama: true },
  pro:     { allow_opus: false, allow_sonnet: true,  allow_haiku: true,  allow_ollama: true },
  basic:   { allow_opus: false, allow_sonnet: false, allow_haiku: true,  allow_ollama: true },
  free:    { allow_opus: false, allow_sonnet: false, allow_haiku: false, allow_ollama: true }
};

function tierCaps(tenant) {
  return TIER_CAPS[tenant?.tier] || TIER_CAPS.basic;
}

function selectModel(opts) {
  const tenant = opts.tenant || {};
  const caps = tierCaps(tenant);
  const rawTask = (opts.task || 'chat').toString();
  const task = TASK_ALIASES[rawTask] || rawTask;
  const budgetLeftPct = typeof opts.budgetLeftPct === 'number' ? opts.budgetLeftPct : 100;
  const useOllama = ollamaEnabled() && caps.allow_ollama;

  // Hard fallback: budget exhausted → Ollama if available, else Haiku as last resort.
  if (budgetLeftPct <= 0) {
    if (useOllama) return pick('ollama', 'mistral', 'budget exhausted; falling back to local Ollama');
    return pick('anthropic', 'claude-haiku-4-5', 'budget exhausted; using cheapest Anthropic model (no Ollama configured)');
  }

  // Free tier or near-zero budget: prefer Ollama for everything that isn't research.
  if (budgetLeftPct < 5 || tenant.tier === 'free') {
    if (useOllama && task !== 'research') {
      return pick('ollama', 'mistral', 'low budget / free tier; routing to Ollama', { provider: 'anthropic', model: 'claude-haiku-4-5' });
    }
  }

  // Drafts / summaries: lightweight task, prefer Ollama if available.
  if (task === 'draft') {
    if (useOllama) return pick('ollama', 'mistral', 'draft task → Ollama (free)', { provider: 'anthropic', model: 'claude-haiku-4-5' });
    return pick('anthropic', 'claude-haiku-4-5', 'draft task → Haiku (Ollama not configured)');
  }

  // Research: needs Anthropic web_search. Sonnet for pro+, Haiku otherwise.
  if (task === 'research') {
    if (caps.allow_sonnet) return pick('anthropic', 'claude-sonnet-4-6', 'research task → Sonnet (with web_search)');
    return pick('anthropic', 'claude-haiku-4-5', 'research task → Haiku (tier caps Sonnet)');
  }

  // Complex reasoning: Opus only for premium tier.
  if (task === 'complex') {
    if (caps.allow_opus) return pick('anthropic', 'claude-opus-4-7', 'complex task → Opus');
    if (caps.allow_sonnet) return pick('anthropic', 'claude-sonnet-4-6', 'complex task → Sonnet (Opus not in tier)');
    return pick('anthropic', 'claude-haiku-4-5', 'complex task → Haiku (Sonnet/Opus not in tier)');
  }

  // Default chat:
  //   - basic tier → Haiku
  //   - pro / premium → Haiku still (cheap), Sonnet only when explicitly requested via mode
  if (opts.mode === 'smart' && caps.allow_sonnet) return pick('anthropic', 'claude-sonnet-4-6', 'mode=smart → Sonnet');
  if (opts.mode === 'deep'  && caps.allow_opus)   return pick('anthropic', 'claude-opus-4-7', 'mode=deep → Opus');
  if (opts.mode === 'deep'  && caps.allow_sonnet) return pick('anthropic', 'claude-sonnet-4-6', 'mode=deep → Sonnet (Opus not in tier)');

  return pick('anthropic', 'claude-haiku-4-5', 'default chat → Haiku');
}

module.exports = {
  TIER_CAPS,
  TASK_ALIASES,
  ollamaEnabled,
  selectModel
};
