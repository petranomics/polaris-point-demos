// /api/photo-classify.js — Categorize Google-pulled photos via Haiku 4.5 vision.
// POST { photos: [url, ...] } → { results: [{ url, category }, ...] }
// Categories: logo | people | vehicle | storefront | service | exterior | interior | food | product | other
// Logs each call into beacons_usage_log under app='polaris-point' for the API Usage dashboard.
const { logUsage } = require('../lib/usage-logger.cjs');

const MODEL = 'claude-haiku-4-5-20251001';
const VALID_CATEGORIES = ['logo', 'people', 'vehicle', 'storefront', 'service', 'exterior', 'interior', 'food', 'product', 'other'];

const PROMPT =
  'Categorize this image for a small-business website. Reply with EXACTLY ONE WORD from this list and nothing else:\n' +
  'logo, people, vehicle, storefront, service, exterior, interior, food, product, other.\n\n' +
  'Guidelines:\n' +
  '- "logo" = a brand mark or wordmark on a flat background.\n' +
  '- "people" = staff/team/customers visible.\n' +
  '- "vehicle" = service truck/van with branding.\n' +
  '- "storefront" = building exterior with the business sign.\n' +
  '- "service" = work being performed (someone fixing a pipe, cutting hair, etc).\n' +
  '- "food" or "product" only when those clearly dominate.\n' +
  '- "other" if you cannot tell.';

async function classifyOne(apiKey, imageUrl) {
  const t0 = Date.now();
  let resp, data;
  try {
    resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 12,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'url', url: imageUrl } },
            { type: 'text', text: PROMPT }
          ]
        }]
      })
    });
    data = await resp.json();
  } catch (err) {
    return { url: imageUrl, category: 'other', error: err.message };
  }
  const latencyMs = Date.now() - t0;

  if (data && data.error) {
    return { url: imageUrl, category: 'other', error: data.error.message || 'api error' };
  }

  // Log the call so it shows up in the API Usage dashboard.
  try {
    await logUsage({
      app: 'polaris-point',
      endpoint: '/api/photo-classify',
      model: MODEL,
      provider: 'anthropic',
      response: data,
      latencyMs: latencyMs
    });
  } catch (e) { /* logging is best-effort */ }

  const raw = (data && data.content && data.content[0] && data.content[0].text || '').trim().toLowerCase();
  const word = raw.replace(/[^a-z]/g, ' ').split(/\s+/).find(function(w) { return VALID_CATEGORIES.indexOf(w) >= 0; });
  return { url: imageUrl, category: word || 'other' };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const body = req.body;
  if (!body || !Array.isArray(body.photos) || !body.photos.length) {
    return res.status(400).json({ error: 'photos array required' });
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  // Cap to 10 — keeps Haiku spend bounded per call. Caller is the build-site
  // form which already slices to the same window.
  const urls = body.photos.slice(0, 10).filter(function(u) { return typeof u === 'string' && /^https?:/.test(u); });
  if (!urls.length) return res.status(400).json({ error: 'no valid http(s) URLs in photos' });

  try {
    const results = await Promise.all(urls.map(function(u) { return classifyOne(apiKey, u); }));
    return res.status(200).json({ model: MODEL, results: results });
  } catch (err) {
    return res.status(500).json({ error: 'Classification failed: ' + err.message });
  }
};
