// /api/generate.js — Content generation via VPS local LLM
// Usage: POST /api/generate { type, context }
// Types: blog_post, seo_copy, about_text, service_desc, meta_desc
const { logUsage } = require('../lib/usage-logger.cjs');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  var body = req.body;
  if (!body || !body.type) return res.status(400).json({ error: 'type is required' });

  var prompts = {
    blog_post: function(ctx) {
      return 'Write a full SEO-optimized blog post for a ' + (ctx.industry || 'local business') + ' called "' + (ctx.businessName || 'the business') + '" in ' + (ctx.city || 'the area') + '.\n' +
        'Title: ' + (ctx.title || 'Untitled') + '\n' +
        'Target keywords: ' + (ctx.keywords || ctx.industry || '') + '\n' +
        'Tone: professional but approachable, written for homeowners/customers.\n' +
        'Length: 600-800 words.\n' +
        'Include: intro paragraph, 3-4 subheadings with content, a conclusion with CTA to contact the business.\n' +
        'Return ONLY the blog post content in markdown format. No meta commentary.';
    },
    seo_copy: function(ctx) {
      return 'Write SEO-optimized website copy for a ' + (ctx.industry || 'local business') + ' called "' + (ctx.businessName || '') + '" in ' + (ctx.city || '') + '.\n' +
        'Section: ' + (ctx.section || 'hero') + '\n' +
        'Target keywords: ' + (ctx.keywords || '') + '\n' +
        'Return a JSON object with fields: headline, subtext, cta_text. Keep it concise and action-oriented.';
    },
    about_text: function(ctx) {
      return 'Write a compelling About Us section for ' + (ctx.businessName || 'a local business') + ', a ' + (ctx.industry || '') + ' company in ' + (ctx.city || '') + '.\n' +
        'Years in business: ' + (ctx.years || '10+') + '\n' +
        'Key selling points: ' + (ctx.sellingPoints || 'licensed, insured, locally owned') + '\n' +
        '150-200 words. Professional, trustworthy tone. Include location keywords for SEO.';
    },
    service_desc: function(ctx) {
      return 'Write a service description for "' + (ctx.serviceName || '') + '" offered by ' + (ctx.businessName || 'a local business') + ' in ' + (ctx.city || '') + '.\n' +
        '2-3 sentences. Focus on customer benefit, not features. Include relevant keywords.';
    },
    meta_desc: function(ctx) {
      return 'Write an SEO meta description for ' + (ctx.businessName || 'a local business') + ', a ' + (ctx.industry || '') + ' in ' + (ctx.city || '') + '.\n' +
        'Services: ' + (ctx.services || '') + '\n' +
        'Max 160 characters. Include a call to action and location.';
    },
    site_compose: function(ctx) {
      return 'Compose website content for a ' + (ctx.industry || 'local business') + ' called "' + (ctx.businessName || 'the business') + '" in ' + (ctx.city || 'their area') + '. ' +
        'This business has no online footprint yet, so invent plausible, professional content a typical successful business in this industry might publish.\n\n' +
        'Return ONLY a valid JSON object (no markdown fences, no commentary, no preamble) with this exact shape:\n' +
        '{\n' +
        '  "hero": { "headline": "string", "subtext": "string" },\n' +
        '  "about": { "title": "string", "text": "string" },\n' +
        '  "services": [{ "name": "string", "desc": "string" }],\n' +
        '  "reviews": [{ "text": "string", "author": "string", "location": "string" }],\n' +
        '  "service_areas": "string"\n' +
        '}\n\n' +
        'Constraints:\n' +
        '- hero.headline: 4-8 words, action-oriented, include the city when provided.\n' +
        '- hero.subtext: 1-2 sentences, mention licensing/insurance/experience as relevant.\n' +
        '- about.title: 3-6 words, format like "<City> Trusts <Business Short Name>".\n' +
        '- about.text: 130-170 words. Use the business name. Emphasize quality, trust, local service.\n' +
        '- services: exactly 5 items. Names 2-4 words. Descriptions 1 sentence focused on customer benefit.\n' +
        '- reviews: exactly 3 items. 2-3 sentences each, realistic but generic (no specific addresses). Author format "First L." (e.g. "Sarah M."). Locations should be nearby cities/neighborhoods to the service area.\n' +
        '- service_areas: 3-5 city or neighborhood names near "' + (ctx.city || '') + '", comma-separated.';
    }
  };

  var buildPrompt = prompts[body.type];
  if (!buildPrompt) return res.status(400).json({ error: 'Unknown type: ' + body.type + '. Valid: ' + Object.keys(prompts).join(', ') });

  var prompt = buildPrompt(body.context || {});
  var text = '';
  var source = '';

  try {
    // Try VPS first
    var vpsUrl = process.env.VPS_API_URL;
    var vpsSecret = process.env.VPS_API_SECRET;

    if (vpsUrl && vpsSecret) {
      try {
        var vpsResp = await fetch(vpsUrl + '/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': vpsSecret },
          body: JSON.stringify({ prompt: prompt, model: 'mistral' }),
          signal: AbortSignal.timeout(60000), // 60s for longer content
        });
        if (vpsResp.ok) {
          var vpsData = await vpsResp.json();
          text = vpsData.response || vpsData.text || '';
          if (text) source = 'vps';
        }
      } catch (e) {
        console.log('[generate] VPS unavailable:', e.message);
      }
    }

    // Fallback to Anthropic
    if (!text) {
      var apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) return res.status(500).json({ error: 'No AI backend available' });

      var claudeModel = 'claude-haiku-4-5-20251001';
      var t0 = Date.now();
      var resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: claudeModel,
          max_tokens: 4000,
          messages: [{ role: 'user', content: prompt }]
        })
      });
      var data = await resp.json();
      if (data.error) return res.status(500).json({ error: data.error.message });
      text = data.content && data.content[0] ? data.content[0].text : '';
      source = 'anthropic';
      await logUsage({
        app: 'beacons',
        endpoint: '/api/generate',
        model: claudeModel,
        provider: 'anthropic',
        response: data,
        latencyMs: Date.now() - t0,
        metadata: { type: body.type }
      });
    }

    return res.status(200).json({ content: text, type: body.type, source: source });
  } catch (err) {
    return res.status(500).json({ error: 'Generation failed: ' + err.message });
  }
};
