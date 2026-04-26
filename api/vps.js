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

  // Intercept outreach-audit and run with Claude Haiku — way faster than Mistral on VPS (~3s vs 30-60s)
  if (action === 'agent/outreach-audit' && req.method === 'POST' && process.env.ANTHROPIC_API_KEY) {
    return runHaikuAudit(req, res);
  }
  if (action === 'agent/outreach-audit/health') {
    return res.json({ status: 'healthy', agent: 'outreach-audit', model: process.env.ANTHROPIC_API_KEY ? 'claude-haiku-4-5' : 'mistral', timestamp: new Date().toISOString() });
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
