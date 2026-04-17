// /root/outreach-enrich.js
// Deep prospect analysis: reviews, site audit, competitive intel
// Returns structured profile used by outreach-email for personalized emails
const axios = require('axios');

const OLLAMA_URL = 'http://localhost:11434/api/generate';
const TIMEOUT = 120000;

const verifyKey = (req, res, next) => {
  if (req.headers['x-api-key'] !== process.env.AGENT_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Fetch Yelp reviews via the Vercel proxy
async function fetchYelpData(bizName, location, yelpApiBase) {
  try {
    const url = yelpApiBase + '/api/yelp?q=' + encodeURIComponent(bizName) + '&location=' + encodeURIComponent(location);
    const resp = await axios.get(url, { timeout: 15000 });
    return resp.data;
  } catch { return null; }
}

// Fetch the website HTML
async function fetchSiteHtml(siteUrl) {
  try {
    const url = siteUrl.startsWith('http') ? siteUrl : 'https://' + siteUrl;
    const start = Date.now();
    const resp = await axios.get(url, {
      timeout: 15000,
      maxRedirects: 5,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PolarisPointAudit/1.0)' },
      validateStatus: () => true
    });
    return {
      html: typeof resp.data === 'string' ? resp.data.substring(0, 8000) : '',
      responseTime: Date.now() - start,
      statusCode: resp.status,
      finalUrl: resp.request?.res?.responseUrl || url,
      isHttps: (resp.request?.res?.responseUrl || url).startsWith('https')
    };
  } catch (err) {
    return { html: '', error: err.message, responseTime: 0, statusCode: 0, isHttps: false };
  }
}

const handler = async (req, res) => {
  try {
    const { lead, vercel_host } = req.body;
    if (!lead || !lead.biz_name) {
      return res.status(400).json({ error: 'Missing required field: lead.biz_name' });
    }

    const hasWebsite = lead.website && lead.website.toLowerCase() !== 'none' && lead.website.trim() !== '';
    const location = lead.address || lead.city || 'TX';
    const host = vercel_host || 'https://polaris-point-demos.com';

    // Step 1: Gather data in parallel
    const tasks = [];

    // Always try to get Yelp data for reviews
    tasks.push(fetchYelpData(lead.biz_name, location, host));

    // If they have a website, fetch it
    if (hasWebsite) {
      tasks.push(fetchSiteHtml(lead.website));
    } else {
      tasks.push(Promise.resolve(null));
    }

    const [yelpData, siteData] = await Promise.all(tasks);

    // Step 2: Build the analysis prompt
    let reviewSection = '';
    let reviews = [];
    if (yelpData && yelpData.reviews && yelpData.reviews.length) {
      reviews = yelpData.reviews;
      reviewSection = `
YELP REVIEWS (${yelpData.reviewCount || reviews.length} total, ${yelpData.rating || '?'} stars):
${reviews.map((r, i) => `Review ${i + 1} (${r.rating} stars, by ${r.author}): "${r.text}"`).join('\n')}`;
    }

    let siteSection = '';
    if (siteData && siteData.html) {
      siteSection = `
WEBSITE ANALYSIS:
URL: ${lead.website}
HTTPS: ${siteData.isHttps}
Response time: ${siteData.responseTime}ms
Status code: ${siteData.statusCode}
HTML excerpt (first 3000 chars):
${siteData.html.substring(0, 3000)}`;
    } else if (hasWebsite) {
      siteSection = `
WEBSITE: ${lead.website} — COULD NOT FETCH (site may be down or blocking requests)`;
    }

    const prompt = `You are a business intelligence analyst preparing a prospect profile for a web design sales team.

BUSINESS: ${lead.biz_name}
INDUSTRY: ${lead.industry || 'unknown'}
CONTACT: ${lead.contact || 'unknown'}
PHONE: ${lead.phone || 'unknown'}
ADDRESS: ${lead.address || 'unknown'}
HAS WEBSITE: ${hasWebsite ? 'Yes — ' + lead.website : 'No'}
${reviewSection}
${siteSection}

Analyze everything above and create a comprehensive prospect profile. Be specific — cite actual review quotes and actual website issues.

Return ONLY valid JSON, no markdown:
{
  "summary": "2-3 sentence overview of this business and their online presence",
  "strengths": ["specific things they're doing well — cite review quotes if available"],
  "weaknesses": ["specific problems — negative review themes, site issues, missing online presence"],
  "review_analysis": {
    "overall_sentiment": "positive|mixed|negative|no_reviews",
    "avg_rating": null or number,
    "total_reviews": number,
    "positive_themes": ["what customers love — quote specific phrases"],
    "negative_themes": ["complaints and pain points — quote specific phrases"],
    "worst_review_quote": "the most concerning review quote, or null",
    "review_response_rate": "do they respond to reviews? (if visible)"
  },
  "site_analysis": {
    "has_site": true/false,
    "score": 1-10 or null if no site,
    "https": true/false/null,
    "mobile_ready": true/false/null,
    "design_quality": "professional|template|outdated|broken|none",
    "specific_issues": ["list each specific problem found in the HTML"],
    "missing_features": ["things a modern site should have that theirs doesn't"],
    "seo_issues": ["title tag problems, missing meta description, no h1, etc"]
  },
  "outreach_angle": "the single strongest pitch angle for this specific business — what would make them say yes",
  "personalization_hooks": ["3-5 specific things to reference in an email or call that show you've done your homework"],
  "risk_factors": ["reasons they might say no, and how to address them"],
  "recommended_approach": "email|call|in_person — and why"
}`;

    const llmRes = await axios.post(OLLAMA_URL, {
      model: 'mistral',
      prompt,
      stream: false
    }, { timeout: TIMEOUT });

    let analysis;
    try {
      const raw = llmRes.data.response.trim();
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      analysis = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch (parseErr) {
      // Return raw text as summary if JSON parse fails
      analysis = {
        summary: llmRes.data.response.trim().substring(0, 500),
        strengths: [],
        weaknesses: [],
        review_analysis: {
          overall_sentiment: reviews.length ? 'unknown' : 'no_reviews',
          avg_rating: yelpData ? yelpData.rating : null,
          total_reviews: yelpData ? yelpData.reviewCount : 0,
          positive_themes: [],
          negative_themes: [],
          worst_review_quote: null,
          review_response_rate: 'unknown'
        },
        site_analysis: {
          has_site: hasWebsite,
          score: null,
          specific_issues: [],
          missing_features: [],
          seo_issues: []
        },
        outreach_angle: 'Could not parse detailed analysis',
        personalization_hooks: [],
        risk_factors: [],
        recommended_approach: hasWebsite ? 'email' : 'call',
        _parse_warning: 'LLM output was not valid JSON'
      };
    }

    // Attach raw data for the frontend
    analysis._raw = {
      yelp_rating: yelpData ? yelpData.rating : null,
      yelp_review_count: yelpData ? yelpData.reviewCount : 0,
      yelp_reviews: reviews,
      yelp_categories: yelpData ? yelpData.categories : [],
      yelp_photos: yelpData ? (yelpData.photos || []) : [],
      has_website: hasWebsite,
      site_response_time: siteData ? siteData.responseTime : null,
      site_status_code: siteData ? siteData.statusCode : null,
      site_is_https: siteData ? siteData.isHttps : null
    };

    res.json({
      success: true,
      result: analysis,
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
    res.json({ status: 'healthy', agent: 'outreach-enrich', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'unhealthy', agent: 'outreach-enrich', error: 'Ollama unreachable' });
  }
};

module.exports = { verifyKey, handler, healthCheck };
