// /api/vps.js — Proxy to Hostinger VPS for LLM and agent tasks
// Routes requests through Vercel so frontends don't call VPS directly.
// Usage:
//   POST /api/vps?action=generate            — content generation via local Ollama
//   POST /api/vps?action=agent/outreach-email — outreach agent
//   GET  /api/vps?action=health              — VPS health check
//   GET  /api/vps?action=agent/outreach-email/health — agent health

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  var vpsBase = process.env.VPS_API_URL;
  var vpsSecret = process.env.VPS_API_SECRET;

  if (!vpsBase || !vpsSecret) {
    return res.status(500).json({ error: 'VPS not configured' });
  }

  // Strip trailing path from VPS_API_URL to get base (e.g. http://72.60.120.245:3000/agent/analyze -> http://72.60.120.245:3000)
  var baseUrl = vpsBase.replace(/\/agent\/.*$/, '').replace(/\/generate$/, '').replace(/\/+$/, '');

  var action = req.query.action || 'health';

  // Allowlist of valid actions to prevent open relay
  var allowed = [
    'health', 'generate',
    'agent/outreach-email', 'agent/outreach-email/health',
    'agent/outreach-callprep', 'agent/outreach-callprep/health',
    'agent/outreach-audit', 'agent/outreach-audit/health',
    'agent/outreach-enrich', 'agent/outreach-enrich/health',
    'agent/outreach-draft', 'agent/outreach-draft/health',
    'agent/analyze', 'agent/health',
    'api/monitoring/summary', 'api/monitoring/agents',
    'agent/beacon-chat', 'agent/beacon-chat/health',
    'agent/beacon-content', 'agent/beacon-content/health',
    'agent/beacon-monitor', 'agent/beacon-monitor/health',
    'agent/beacon-leads', 'agent/beacon-leads/health'
  ];
  if (!allowed.includes(action)) {
    return res.status(403).json({ error: 'Action not allowed: ' + action });
  }

  // Intercept outreach agents and run with Claude Haiku — ~3s vs 30-60s on the VPS
  if (process.env.ANTHROPIC_API_KEY && req.method === 'POST') {
    if (action === 'agent/outreach-audit') return runHaikuAudit(req, res);
    if (action === 'agent/outreach-email') return runHaikuEmail(req, res);
    if (action === 'agent/outreach-callprep') return runHaikuCallPrep(req, res);
    if (action === 'agent/outreach-enrich') return runHaikuEnrich(req, res);
  }
  // Health checks for the migrated agents — return synthetic OK
  var migratedAgents = ['agent/outreach-audit/health', 'agent/outreach-email/health', 'agent/outreach-callprep/health', 'agent/outreach-enrich/health'];
  if (migratedAgents.includes(action) && process.env.ANTHROPIC_API_KEY) {
    var agentName = action.replace('/health', '').replace('agent/', '');
    return res.json({ status: 'healthy', agent: agentName, model: 'claude-haiku-4-5', timestamp: new Date().toISOString() });
  }

  try {
    var endpoint = baseUrl + '/' + action;
    var options = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': vpsSecret,
      },
    };

    if (req.method === 'POST' && req.body) {
      options.body = JSON.stringify(req.body);
    }

    var response = await fetch(endpoint, Object.assign(options, { signal: AbortSignal.timeout(55000) }));
    var data = await response.json();

    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(502).json({ error: 'VPS unreachable: ' + err.message });
  }
};

// Run an audit using Claude Haiku — faster + better than Mistral for this task
async function runHaikuAudit(req, res) {
  try {
    var url = req.body && req.body.url;
    if (!url) return res.status(400).json({ error: 'Missing url' });

    var targetUrl = url.startsWith('http') ? url : 'https://' + url;

    // Step 1: Fetch the website HTML
    var html = '';
    var fetchError = null;
    var responseTime = 0;
    var statusCode = 0;
    var isHttps = targetUrl.startsWith('https');

    try {
      var start = Date.now();
      var pageRes = await fetch(targetUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PolarisPointAudit/1.0)' },
        signal: AbortSignal.timeout(15000),
        redirect: 'follow'
      });
      responseTime = Date.now() - start;
      statusCode = pageRes.status;
      var fullHtml = await pageRes.text();
      html = typeof fullHtml === 'string' ? fullHtml.substring(0, 6000) : '';
      isHttps = (pageRes.url || targetUrl).startsWith('https');
    } catch (err) {
      fetchError = err.message;
    }

    if (fetchError || !html) {
      return res.json({
        success: true,
        result: {
          score: 1,
          url: targetUrl,
          https: false,
          mobile_ready: false,
          estimated_age: 'Could not fetch site',
          has_cta: false,
          design_quality: 'broken',
          issues: ['Site unreachable: ' + (fetchError || 'empty response')],
          positives: [],
          response_time_ms: responseTime,
          status_code: statusCode
        },
        timestamp: new Date().toISOString()
      });
    }

    // Step 2: Ask Claude Haiku to analyze
    var prompt = 'You are a web developer auditing a small business website. Analyze this HTML and provide a quality score.\n\n'
      + 'URL: ' + targetUrl + '\n'
      + 'HTTPS: ' + isHttps + '\n'
      + 'Response time: ' + responseTime + 'ms\n'
      + 'Status code: ' + statusCode + '\n'
      + 'HTML (truncated):\n'
      + html.substring(0, 4000) + '\n\n'
      + 'Evaluate:\n'
      + '1. Has viewport meta tag for mobile?\n'
      + '2. Copyright year or last update hints\n'
      + '3. Clear call-to-action (phone, contact form, booking)?\n'
      + '4. Professional design or generic template?\n'
      + '5. Contact info visible?\n'
      + '6. Social media links?\n'
      + '7. Page load indicators (inline styles, image optimization)\n'
      + '8. SEO basics (title, meta description, h1)\n\n'
      + 'Return ONLY valid JSON, no markdown:\n'
      + '{\n'
      + '  "score": <1-10 integer>,\n'
      + '  "https": ' + isHttps + ',\n'
      + '  "mobile_ready": <true/false>,\n'
      + '  "estimated_age": "<description>",\n'
      + '  "has_cta": <true/false>,\n'
      + '  "design_quality": "professional|template|outdated|broken",\n'
      + '  "issues": ["list"],\n'
      + '  "positives": ["list"]\n'
      + '}';

    var aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      }),
      signal: AbortSignal.timeout(30000)
    });

    if (!aiRes.ok) {
      var errText = await aiRes.text();
      return res.status(502).json({ error: 'Claude API error: ' + errText.substring(0, 200) });
    }

    var aiData = await aiRes.json();
    var raw = aiData.content && aiData.content[0] ? aiData.content[0].text : '';

    var result;
    try {
      var match = raw.match(/\{[\s\S]*\}/);
      result = JSON.parse(match ? match[0] : raw);
    } catch (parseErr) {
      // Heuristic fallback
      var hasViewport = html.includes('viewport');
      var hasCta = /tel:|mailto:|contact|book|call|schedule/i.test(html);
      var copyrightMatch = html.match(/©\s*(\d{4})|copyright\s*(\d{4})/i);
      var copyrightYear = copyrightMatch ? (copyrightMatch[1] || copyrightMatch[2]) : null;
      result = {
        score: (isHttps ? 2 : 0) + (hasViewport ? 2 : 0) + (hasCta ? 2 : 0) + (copyrightYear && parseInt(copyrightYear) >= 2024 ? 2 : 0),
        https: isHttps,
        mobile_ready: hasViewport,
        estimated_age: copyrightYear ? 'Copyright ' + copyrightYear : 'Unknown age',
        has_cta: hasCta,
        design_quality: 'unknown',
        issues: raw.substring(0, 200).split('\n').filter(function(l) { return l.trim(); }),
        positives: [],
        _parse_warning: 'LLM output was not valid JSON, heuristic audit used'
      };
    }

    result.url = targetUrl;
    result.response_time_ms = responseTime;
    result.status_code = statusCode;

    return res.json({
      success: true,
      result: result,
      model: 'claude-haiku-4-5',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({ error: 'Audit failed: ' + err.message });
  }
}

// Shared helper: call Claude Haiku with a prompt, return parsed JSON or null
async function callHaiku(prompt, maxTokens) {
  var aiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens || 1500,
      messages: [{ role: 'user', content: prompt }]
    }),
    signal: AbortSignal.timeout(30000)
  });
  if (!aiRes.ok) {
    var errText = await aiRes.text();
    throw new Error('Claude API error: ' + errText.substring(0, 200));
  }
  var aiData = await aiRes.json();
  var raw = aiData.content && aiData.content[0] ? aiData.content[0].text : '';
  return { raw: raw, tokens: aiData.usage ? aiData.usage.input_tokens + aiData.usage.output_tokens : 0 };
}

function tryParseJson(raw) {
  try {
    var match = raw.match(/\{[\s\S]*\}/);
    return JSON.parse(match ? match[0] : raw);
  } catch (e) { return null; }
}

// Outreach email generator with Haiku
async function runHaikuEmail(req, res) {
  try {
    var lead = req.body && req.body.lead;
    var demo = (req.body && req.body.demo_url) || '';
    var enrichment = req.body && req.body.enrichment;
    if (!lead || !lead.biz_name) return res.status(400).json({ error: 'Missing lead.biz_name' });

    var hasWebsite = lead.website && lead.website.toLowerCase() !== 'none' && lead.website.trim() !== '';
    var name = lead.contact || 'the owner';
    var biz = lead.biz_name;
    var industry = lead.industry || 'local business';

    // Build enrichment context if provided
    var enrichContext = '';
    if (enrichment) {
      if (enrichment.summary) enrichContext += '\nBUSINESS SUMMARY: ' + enrichment.summary;
      if (enrichment.review_analysis) {
        var ra = enrichment.review_analysis;
        enrichContext += '\nREVIEW INTEL:';
        if (ra.overall_sentiment) enrichContext += '\n- Sentiment: ' + ra.overall_sentiment;
        if (ra.positive_themes && ra.positive_themes.length) enrichContext += '\n- Positive themes: ' + ra.positive_themes.join('; ');
        if (ra.negative_themes && ra.negative_themes.length) enrichContext += '\n- Negative themes: ' + ra.negative_themes.join('; ');
        if (ra.worst_review_quote) enrichContext += '\n- Worst review quote: "' + ra.worst_review_quote + '"';
      }
      if (enrichment.site_analysis) {
        var sa = enrichment.site_analysis;
        enrichContext += '\nSITE INTEL:';
        if (sa.specific_issues && sa.specific_issues.length) enrichContext += '\n- Issues: ' + sa.specific_issues.join('; ');
        if (sa.missing_features && sa.missing_features.length) enrichContext += '\n- Missing: ' + sa.missing_features.join('; ');
      }
      if (enrichment.outreach_angle) enrichContext += '\nBEST ANGLE: ' + enrichment.outreach_angle;
      if (enrichment.personalization_hooks && enrichment.personalization_hooks.length) enrichContext += '\nPERSONALIZATION HOOKS: ' + enrichment.personalization_hooks.join('; ');
    }

    var prompt;
    if (hasWebsite) {
      prompt = 'You are a professional sales copywriter. Write a cold outreach email for a business that HAS an existing website.\n\n'
        + 'Business: ' + biz + '\n'
        + 'Contact: ' + name + '\n'
        + 'Industry: ' + industry + '\n'
        + 'Current website: ' + lead.website + '\n'
        + 'Rating: ' + (lead.rating || 'unknown') + '\n'
        + 'Demo URL: ' + demo + '\n'
        + enrichContext + '\n\n'
        + 'Rules:\n'
        + '- Subject line under 50 characters, no clickbait\n'
        + '- Reference SPECIFIC issues from the intel above — do NOT use generic points\n'
        + '- Frame as opportunities not insults — you want to help, not criticize\n'
        + '- Link to the demo as "here\'s what a refreshed version could look like"\n'
        + '- Under 150 words for the body\n'
        + '- End with a soft CTA: offer a free audit\n'
        + '- Tone: helpful neighbor, not salesman\n'
        + '- Sign off as Pete from Polaris Point\n\n'
        + 'Return ONLY valid JSON, no markdown:\n'
        + '{"subject":"...","body":"...","follow_up":"...(shorter 3-sentence follow-up if no response after 5 days)"}';
    } else {
      prompt = 'You are a professional sales copywriter. Write a cold outreach email for a business with NO website.\n\n'
        + 'Business: ' + biz + '\n'
        + 'Contact: ' + name + '\n'
        + 'Industry: ' + industry + '\n'
        + 'Rating: ' + (lead.rating || 'unknown') + '\n'
        + 'Demo URL: ' + demo + '\n'
        + enrichContext + '\n\n'
        + 'Rules:\n'
        + '- Subject line under 50 characters, no clickbait\n'
        + '- Open with something SPECIFIC to their business from the intel above — show you\'ve done your homework\n'
        + '- Reference what competitors with websites are doing\n'
        + '- Link to the demo as a free preview of what their site could look like\n'
        + '- Under 150 words for the body\n'
        + '- End with: "Want me to send you a free mockup?"\n'
        + '- Tone: helpful neighbor, not salesman\n'
        + '- Sign off as Pete from Polaris Point\n\n'
        + 'Return ONLY valid JSON, no markdown:\n'
        + '{"subject":"...","body":"...","follow_up":"...(shorter 3-sentence follow-up if no response after 5 days)"}';
    }

    var ai = await callHaiku(prompt, 1500);
    var result = tryParseJson(ai.raw);
    if (!result) {
      result = {
        subject: 'Quick question about ' + biz,
        body: ai.raw.trim(),
        follow_up: 'Just following up on my earlier note about ' + biz + '. Would love to chat for 5 minutes.',
        _parse_warning: 'LLM output was not valid JSON, raw text used as body'
      };
    }
    return res.json({ success: true, result: result, model: 'claude-haiku-4-5', timestamp: new Date().toISOString() });
  } catch (err) {
    return res.status(500).json({ error: 'Email generation failed: ' + err.message });
  }
}

// Call prep generator with Haiku
async function runHaikuCallPrep(req, res) {
  try {
    var lead = req.body && req.body.lead;
    if (!lead || !lead.biz_name) return res.status(400).json({ error: 'Missing lead.biz_name' });

    var hasWebsite = lead.website && lead.website.toLowerCase() !== 'none' && lead.website.trim() !== '';
    var name = lead.contact || 'the owner';
    var biz = lead.biz_name;
    var industry = lead.industry || 'local business';

    var prompt = 'You are a sales coach preparing a cold call script for a web design sales rep named Pete from Polaris Point.\n\n'
      + 'Target business: ' + biz + '\n'
      + 'Contact name: ' + name + '\n'
      + 'Industry: ' + industry + '\n'
      + 'Has website: ' + (hasWebsite ? 'Yes — ' + lead.website : 'No') + '\n'
      + 'Rating: ' + (lead.rating || 'unknown') + '\n'
      + 'Years in business: ' + (lead.years_in_biz || 'unknown') + '\n'
      + 'Address: ' + (lead.address || 'unknown') + '\n\n'
      + 'Create a call preparation sheet with:\n'
      + '1. An opening line (natural, not scripted-sounding, references their specific business)\n'
      + '2. 5 talking points relevant to their situation\n'
      + '3. 4 common objections with persuasive but respectful responses\n'
      + '4. A closing statement / CTA\n\n'
      + 'Return ONLY valid JSON, no markdown:\n'
      + '{"opening":"...","talking_points":["...","...","...","...","..."],"objections":[{"objection":"...","response":"..."},{"objection":"...","response":"..."},{"objection":"...","response":"..."},{"objection":"...","response":"..."}],"closing":"..."}';

    var ai = await callHaiku(prompt, 1500);
    var result = tryParseJson(ai.raw);
    if (!result) {
      result = {
        opening: 'Hi ' + name + ', this is Pete from Polaris Point. I work with local ' + industry + ' businesses to help them get found online.',
        talking_points: ['97% of customers search online before calling', ai.raw.substring(0, 200)],
        objections: [{ objection: 'Not interested', response: 'Totally understand. Mind if I send a quick demo link? No follow-up unless you reach out.' }],
        closing: 'Would it help if I sent you a link to see what your site could look like?',
        _parse_warning: 'LLM output was not valid JSON, using fallback'
      };
    }
    return res.json({ success: true, result: result, model: 'claude-haiku-4-5', timestamp: new Date().toISOString() });
  } catch (err) {
    return res.status(500).json({ error: 'Call prep failed: ' + err.message });
  }
}

// Lead enrichment with Haiku — fetches website, analyzes, returns full prospect intel
async function runHaikuEnrich(req, res) {
  try {
    var lead = req.body && req.body.lead;
    if (!lead || !lead.biz_name) return res.status(400).json({ error: 'Missing lead.biz_name' });

    var hasWebsite = lead.website && lead.website.toLowerCase() !== 'none' && lead.website.trim() !== '';

    // Step 1: Fetch site if available
    var siteData = null;
    if (hasWebsite) {
      try {
        var siteUrl = lead.website.startsWith('http') ? lead.website : 'https://' + lead.website;
        var start = Date.now();
        var siteRes = await fetch(siteUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PolarisPointEnrich/1.0)' },
          signal: AbortSignal.timeout(12000),
          redirect: 'follow'
        });
        var siteHtml = await siteRes.text();
        siteData = {
          html: typeof siteHtml === 'string' ? siteHtml.substring(0, 5000) : '',
          responseTime: Date.now() - start,
          statusCode: siteRes.status,
          finalUrl: siteRes.url || siteUrl,
          isHttps: (siteRes.url || siteUrl).startsWith('https')
        };
      } catch (err) {
        siteData = { html: '', error: err.message, responseTime: 0, statusCode: 0, isHttps: false };
      }
    }

    // Step 2: Build prompt
    var siteSection = '';
    if (siteData && siteData.html) {
      siteSection = '\nWEBSITE ANALYSIS:\n'
        + 'URL: ' + lead.website + '\n'
        + 'HTTPS: ' + siteData.isHttps + '\n'
        + 'Response time: ' + siteData.responseTime + 'ms\n'
        + 'Status code: ' + siteData.statusCode + '\n'
        + 'HTML excerpt:\n' + siteData.html.substring(0, 3000);
    } else if (hasWebsite) {
      siteSection = '\nWEBSITE: ' + lead.website + ' — COULD NOT FETCH (site may be down or blocking requests)';
    }

    var prompt = 'You are a business intelligence analyst preparing a prospect profile for a web design sales team.\n\n'
      + 'BUSINESS: ' + lead.biz_name + '\n'
      + 'INDUSTRY: ' + (lead.industry || 'unknown') + '\n'
      + 'CONTACT: ' + (lead.contact || 'unknown') + '\n'
      + 'PHONE: ' + (lead.phone || 'unknown') + '\n'
      + 'ADDRESS: ' + (lead.address || 'unknown') + '\n'
      + 'HAS WEBSITE: ' + (hasWebsite ? 'Yes — ' + lead.website : 'No') + '\n'
      + siteSection + '\n\n'
      + 'Analyze everything above and create a comprehensive prospect profile. Be specific — cite actual website issues you can see in the HTML.\n\n'
      + 'Return ONLY valid JSON, no markdown:\n'
      + '{\n'
      + '  "summary": "2-3 sentence overview of this business and their online presence",\n'
      + '  "strengths": ["specific things they\'re doing well"],\n'
      + '  "weaknesses": ["specific problems"],\n'
      + '  "review_analysis": {"overall_sentiment":"positive|mixed|negative|no_reviews","avg_rating":null,"total_reviews":0,"positive_themes":[],"negative_themes":[],"worst_review_quote":null,"review_response_rate":"unknown"},\n'
      + '  "site_analysis": {"has_site":' + hasWebsite + ',"score":null,"https":null,"mobile_ready":null,"design_quality":"professional|template|outdated|broken|none","specific_issues":[],"missing_features":[],"seo_issues":[]},\n'
      + '  "outreach_angle": "the single strongest pitch angle",\n'
      + '  "personalization_hooks": ["3-5 specific things to reference"],\n'
      + '  "risk_factors": ["reasons they might say no"],\n'
      + '  "recommended_approach": "email|call|in_person — and why"\n'
      + '}';

    var ai = await callHaiku(prompt, 2500);
    var analysis = tryParseJson(ai.raw);
    if (!analysis) {
      analysis = {
        summary: ai.raw.substring(0, 500),
        strengths: [], weaknesses: [],
        review_analysis: { overall_sentiment: 'no_reviews', avg_rating: null, total_reviews: 0, positive_themes: [], negative_themes: [], worst_review_quote: null, review_response_rate: 'unknown' },
        site_analysis: { has_site: hasWebsite, score: null, specific_issues: [], missing_features: [], seo_issues: [] },
        outreach_angle: 'Could not parse detailed analysis',
        personalization_hooks: [], risk_factors: [],
        recommended_approach: hasWebsite ? 'email' : 'call',
        _parse_warning: 'LLM output was not valid JSON'
      };
    }

    analysis._raw = {
      has_website: hasWebsite,
      site_response_time: siteData ? siteData.responseTime : null,
      site_status_code: siteData ? siteData.statusCode : null,
      site_https: siteData ? siteData.isHttps : null
    };

    return res.json({ success: true, result: analysis, model: 'claude-haiku-4-5', timestamp: new Date().toISOString() });
  } catch (err) {
    return res.status(500).json({ error: 'Enrich failed: ' + err.message });
  }
}
