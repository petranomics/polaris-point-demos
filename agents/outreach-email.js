// /home/api-server/agents/outreach-email.js
// Generates personalized cold outreach emails for leads using Mistral
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
    const { lead, demo_url, enrichment } = req.body;
    if (!lead || !lead.biz_name) {
      return res.status(400).json({ error: 'Missing required field: lead.biz_name' });
    }

    const hasWebsite = lead.website && lead.website.toLowerCase() !== 'none' && lead.website.trim() !== '';
    const name = lead.contact || 'there';
    const biz = lead.biz_name;
    const industry = lead.industry || 'local business';
    const demo = demo_url || 'https://polaris-point-demos.com/' + (lead.industry || 'handyman');

    // Build enrichment context if available
    let enrichContext = '';
    if (enrichment) {
      if (enrichment.review_analysis) {
        const ra = enrichment.review_analysis;
        enrichContext += `\nREVIEW INTEL:`;
        enrichContext += `\n- Overall: ${ra.overall_sentiment}, ${ra.avg_rating || '?'} stars, ${ra.total_reviews || 0} reviews`;
        if (ra.positive_themes && ra.positive_themes.length) enrichContext += `\n- Customers love: ${ra.positive_themes.join('; ')}`;
        if (ra.negative_themes && ra.negative_themes.length) enrichContext += `\n- Complaints: ${ra.negative_themes.join('; ')}`;
        if (ra.worst_review_quote) enrichContext += `\n- Worst review: "${ra.worst_review_quote}"`;
      }
      if (enrichment.site_analysis && enrichment.site_analysis.has_site) {
        const sa = enrichment.site_analysis;
        enrichContext += `\nSITE INTEL:`;
        enrichContext += `\n- Score: ${sa.score || '?'}/10, Design: ${sa.design_quality || 'unknown'}`;
        if (sa.specific_issues && sa.specific_issues.length) enrichContext += `\n- Issues: ${sa.specific_issues.join('; ')}`;
        if (sa.seo_issues && sa.seo_issues.length) enrichContext += `\n- SEO problems: ${sa.seo_issues.join('; ')}`;
        if (sa.missing_features && sa.missing_features.length) enrichContext += `\n- Missing: ${sa.missing_features.join('; ')}`;
      }
      if (enrichment.outreach_angle) enrichContext += `\nBEST ANGLE: ${enrichment.outreach_angle}`;
      if (enrichment.personalization_hooks && enrichment.personalization_hooks.length) enrichContext += `\nPERSONALIZATION HOOKS: ${enrichment.personalization_hooks.join('; ')}`;
    }

    const prompt = hasWebsite
      ? `You are a professional sales copywriter. Write a cold outreach email for a business that HAS an existing website.

Business: ${biz}
Contact: ${name}
Industry: ${industry}
Current website: ${lead.website}
Rating: ${lead.rating || 'unknown'}
Demo URL: ${demo}
${enrichContext}

Rules:
- Subject line under 50 characters, no clickbait
- Reference SPECIFIC issues from the intel above — do NOT use generic points
${enrichContext.includes('REVIEW INTEL') ? '- If there are negative reviews, empathize with the problem and position the website as a solution (e.g. "I saw a customer mentioned wait times — an online booking system could help with that")' : ''}
${enrichContext.includes('SITE INTEL') ? '- Reference 2-3 ACTUAL issues found on their site (from the intel above), not hypothetical ones' : '- Reference 2-3 likely issues with their current site (mobile, speed, SEO, outdated design)'}
- Frame as opportunities not insults — you want to help, not criticize
- Link to the demo as "here's what a refreshed version could look like"
- Under 150 words for the body
- End with a soft CTA: offer a free audit
- Tone: helpful neighbor, not salesman
- Sign off as Pete from Polaris Point

Return ONLY valid JSON, no markdown:
{"subject":"...","body":"...","follow_up":"...(shorter 3-sentence follow-up if no response after 5 days)"}`
      : `You are a professional sales copywriter. Write a cold outreach email for a business with NO website.

Business: ${biz}
Contact: ${name}
Industry: ${industry}
Rating: ${lead.rating || 'unknown'}
Demo URL: ${demo}
${enrichContext}

Rules:
- Subject line under 50 characters, no clickbait
- Open with something SPECIFIC to their business from the intel above — show you've done your homework
${enrichContext.includes('REVIEW INTEL') ? '- Reference their reviews: if positive, compliment them ("your customers rave about X"); if negative, position the website as a fix ("a site with an FAQ section could address the common question about Y")' : '- Mention that 97% of customers search online before calling'}
- Reference what competitors with websites are doing
- Link to the demo as a free preview of what their site could look like
- Under 150 words for the body
- End with: "Want me to send you a free mockup?"
- Tone: helpful neighbor, not salesman
- Sign off as Pete from Polaris Point

Return ONLY valid JSON, no markdown:
{"subject":"...","body":"...","follow_up":"...(shorter 3-sentence follow-up if no response after 5 days)"}`;

    const response = await axios.post(OLLAMA_URL, {
      model: 'mistral',
      prompt,
      stream: false
    }, { timeout: TIMEOUT });

    let result;
    try {
      const raw = response.data.response.trim();
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      result = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch (parseErr) {
      result = {
        subject: 'Quick question about ' + biz,
        body: response.data.response.trim(),
        follow_up: 'Just following up on my earlier note about ' + biz + '. Would love to chat for 5 minutes.',
        _parse_warning: 'LLM output was not valid JSON, raw text used as body'
      };
    }

    res.json({
      success: true,
      result,
      has_website: hasWebsite,
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
    res.json({ status: 'healthy', agent: 'outreach-email', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'unhealthy', agent: 'outreach-email', error: 'Ollama unreachable' });
  }
};

module.exports = { verifyKey, handler, healthCheck };
