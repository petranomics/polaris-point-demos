// /home/api-server/agents/outreach-audit.js
// Fetches a business website and scores it for quality, mobile, SEO, etc.
const axios = require('axios');

const OLLAMA_URL = 'http://localhost:11434/api/generate';
const TIMEOUT = 120000;

const verifyKey = (req, res, next) => {
  if (req.headers['x-api-key'] !== process.env.AGENT_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

const handler = async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'Missing required field: url' });
    }

    const targetUrl = url.startsWith('http') ? url : 'https://' + url;

    // Step 1: Fetch the website HTML
    let html = '';
    let fetchError = null;
    let isHttps = targetUrl.startsWith('https');
    let responseTime = 0;
    let statusCode = 0;

    try {
      const start = Date.now();
      const pageRes = await axios.get(targetUrl, {
        timeout: 15000,
        maxRedirects: 5,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PolarisPointAudit/1.0)' },
        validateStatus: () => true
      });
      responseTime = Date.now() - start;
      statusCode = pageRes.status;
      html = typeof pageRes.data === 'string' ? pageRes.data.substring(0, 8000) : '';
      isHttps = (pageRes.request?.res?.responseUrl || targetUrl).startsWith('https');
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

    // Step 2: Ask Mistral to analyze the HTML
    const prompt = `You are a web developer auditing a small business website. Analyze this HTML and provide a quality score.

URL: ${targetUrl}
HTTPS: ${isHttps}
Response time: ${responseTime}ms
Status code: ${statusCode}
HTML (truncated):
${html.substring(0, 4000)}

Evaluate:
1. Has viewport meta tag for mobile? (check for <meta name="viewport")
2. Copyright year or last update hints
3. Clear call-to-action (phone number, contact form, booking button)?
4. Professional design or generic template?
5. Contact info visible (phone, email, address)?
6. Social media links?
7. Page load speed indicators (inline styles vs external, image optimization hints)
8. SEO basics (title tag, meta description, h1 tag)

Return ONLY valid JSON, no markdown:
{
  "score": (1-10 integer),
  "https": ${isHttps},
  "mobile_ready": (true/false based on viewport tag),
  "estimated_age": "description of how current the site appears",
  "has_cta": (true/false),
  "design_quality": "professional|template|outdated|broken",
  "issues": ["list of specific problems found"],
  "positives": ["list of things done well"]
}`;

    const llmRes = await axios.post(OLLAMA_URL, {
      model: 'mistral',
      prompt,
      stream: false
    }, { timeout: TIMEOUT });

    let result;
    try {
      const raw = llmRes.data.response.trim();
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      result = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch (parseErr) {
      // Quick heuristic audit if LLM fails to return JSON
      const hasViewport = html.includes('viewport');
      const hasHttps = isHttps;
      const hasCta = /tel:|mailto:|contact|book|call|schedule/i.test(html);
      const copyrightMatch = html.match(/©\s*(\d{4})|copyright\s*(\d{4})/i);
      const copyrightYear = copyrightMatch ? (copyrightMatch[1] || copyrightMatch[2]) : null;

      result = {
        score: (hasHttps ? 2 : 0) + (hasViewport ? 2 : 0) + (hasCta ? 2 : 0) + (copyrightYear && parseInt(copyrightYear) >= 2024 ? 2 : 0),
        https: hasHttps,
        mobile_ready: hasViewport,
        estimated_age: copyrightYear ? 'Copyright ' + copyrightYear : 'Unknown age',
        has_cta: hasCta,
        design_quality: 'unknown',
        issues: llmRes.data.response.substring(0, 300).split('\n').filter(l => l.trim()),
        positives: [],
        _parse_warning: 'LLM output was not valid JSON, heuristic audit used'
      };
    }

    result.url = targetUrl;
    result.response_time_ms = responseTime;
    result.status_code = statusCode;

    res.json({
      success: true,
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({ error: 'Ollama is not running' });
    }
    if (error.code === 'ECONNABORTED' || (error.message && error.message.includes('timeout'))) {
      return res.status(504).json({ error: 'Request timeout' });
    }
    res.status(500).json({ error: error.message });
  }
};

const healthCheck = async (req, res) => {
  try {
    await axios.post(OLLAMA_URL, { model: 'mistral', prompt: 'test', stream: false }, { timeout: 20000 });
    res.json({ status: 'healthy', agent: 'outreach-audit', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'unhealthy', agent: 'outreach-audit', error: 'Ollama unreachable' });
  }
};

module.exports = { verifyKey, handler, healthCheck };
