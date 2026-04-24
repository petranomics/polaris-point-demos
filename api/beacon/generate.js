// /api/beacon/generate.js — On-demand content generation
// POST: generate social posts, newsletters, blog drafts, etc.
const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const sql = neon(process.env.DATABASE_URL);

  try {
    var body = req.body;
    if (!body.subscription_id || !body.type) {
      return res.status(400).json({ error: 'Missing subscription_id or type' });
    }

    var subId = body.subscription_id;
    var type = body.type; // 'social_post', 'newsletter', 'blog', 'email', 'press_release'

    // Check subscription + budget
    var subs = await sql`
      SELECT id, plan, status, tokens_limit, tokens_used
      FROM beacon_subscriptions WHERE id = ${subId}
    `;
    if (!subs.length) return res.status(404).json({ error: 'Subscription not found' });
    var sub = subs[0];
    if (sub.status !== 'active') return res.status(403).json({ error: 'Subscription not active' });
    if (sub.tokens_used >= sub.tokens_limit) {
      return res.status(429).json({ error: 'Monthly token limit reached' });
    }

    // Fetch context
    var context = await sql`
      SELECT context_type, title, content
      FROM beacon_context WHERE subscription_id = ${subId}
      ORDER BY created_at ASC
    `;

    var brandVoice = '';
    var contextText = '';
    context.forEach(function(c) {
      if (c.context_type === 'brand_voice') {
        brandVoice = c.content;
      } else {
        contextText += '\n[' + (c.title || c.context_type) + ']\n' + c.content + '\n';
      }
    });
    if (contextText.length > 20000) contextText = contextText.substring(0, 20000);

    // Build prompt based on content type
    var prompts = {
      // General
      social_post: 'Generate 5 social media posts for this business. Mix promotional, educational, and engaging content. Keep each under 280 characters. Format as a numbered list.',
      newsletter: 'Write a monthly newsletter email for this business. Include a greeting, 2-3 short sections with updates/tips, and a call to action. Keep it under 500 words. Tone should match the brand voice.',
      blog: 'Write a blog post (600-800 words) relevant to this business and its customers. Include a compelling title, introduction, 3-4 sections with subheadings, and a conclusion with CTA.',
      email: 'Write a professional marketing email for this business. Include subject line, preview text, body (2-3 paragraphs), and CTA button text.',
      press_release: 'Write a press release for this business. Include headline, dateline, lead paragraph, 2-3 body paragraphs with quotes, boilerplate, and contact info.',

      // Real Estate
      listing_post: 'Write 3 social media posts promoting a property listing from the context. Each post should take a different angle: (1) lifestyle — paint a picture of living there, (2) investment — highlight value and market position, (3) features — bedroom/bath count, upgrades, unique selling points. Include price, neighborhood name, and a CTA to schedule a showing. Keep each under 300 characters.',
      listing_description: 'Write an MLS-ready property description (200-300 words) using the listing details from context. Lead with the lifestyle and emotional appeal, then key features (beds, baths, sqft, upgrades), then neighborhood highlights (schools, dining, parks, commute). Professional tone — no ALL CAPS, no excessive exclamation marks. End with a soft CTA.',
      market_report: 'Write a monthly local real estate market update (400-600 words) for the agent\'s service area. Include: median home price and trend, active inventory, average days on market, interest rate context, and what this means for buyers vs sellers. Conversational and authoritative tone — position the agent as the local expert. Include 2-3 specific neighborhood callouts.',
      neighborhood_guide: 'Write a 500-word neighborhood guide for one of the agent\'s service areas. Cover: overall vibe and lifestyle, housing types and typical price range, top schools, best restaurants and coffee shops, parks and outdoor activities, commute to downtown, and who this neighborhood is best for (families, young professionals, retirees, etc.). Make it feel like insider knowledge, not a Wikipedia article.',
      past_client_nurture: 'Write a warm, personal check-in email to a past real estate client. Include: a friendly greeting referencing the season, one relevant home maintenance or home value tip, a brief market update for their area, and a soft referral ask ("Know anyone thinking about buying or selling?"). Keep it under 200 words. Should feel like a note from a friend who happens to be their realtor, not a sales pitch.',
      buyer_drip: 'Write a 5-email drip campaign for new buyer leads. Email 1: welcome + what to expect. Email 2: financing basics and pre-approval tips. Email 3: neighborhood guide for the area they\'re interested in. Email 4: what to look for at showings. Email 5: soft CTA to schedule a buyer consultation. Each email 100-150 words, subject lines included.',
      seller_drip: 'Write a 5-email drip campaign for potential sellers. Email 1: "What\'s your home worth?" with market context. Email 2: 5 things that increase home value before listing. Email 3: what the selling process looks like (timeline). Email 4: why now is a good time to sell (market data). Email 5: CTA to schedule a listing consultation. Each email 100-150 words, subject lines included.'
    };

    var userPrompt = prompts[type] || body.custom_prompt || 'Generate marketing content for this business.';
    if (body.custom_prompt) userPrompt = body.custom_prompt;

    // Route to model
    var message = userPrompt;
    var result;

    if (process.env.ANTHROPIC_API_KEY) {
      // All tiers use Claude Haiku directly
      var systemPrompt = 'You are a marketing content creator. Match the brand voice. Be concise and professional.\n\n== BRAND VOICE ==\n' + brandVoice + '\n\n== BUSINESS CONTEXT ==\n' + contextText;

      var resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content: message }]
        })
      });

      var data = await resp.json();
      result = {
        response: data.content && data.content[0] ? data.content[0].text : '',
        tokens_used: data.usage ? data.usage.input_tokens + data.usage.output_tokens : 0,
        model: 'claude-haiku-4-5'
      };
    } else {
      // VPS Ollama
      var vpsUrl = process.env.VPS_API_URL || 'https://api.polarispoint.io';
      var vpsResp = await fetch(vpsUrl + '/agent/beacon-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.VPS_API_SECRET || ''
        },
        body: JSON.stringify({
          type: type,
          message: message,
          context: contextText,
          brand_voice: brandVoice
        })
      });

      result = await vpsResp.json();
    }

    // Debit tokens
    var tokensUsed = result.tokens_used || 0;
    await sql`
      UPDATE beacon_subscriptions
      SET tokens_used = tokens_used + ${tokensUsed}, updated_at = NOW()
      WHERE id = ${subId}
    `;

    // Update task last_output if this was triggered by a task
    if (body.task_id) {
      await sql`
        UPDATE beacon_tasks
        SET last_run = NOW(), last_output = ${result.response}
        WHERE id = ${body.task_id}
      `;
    }

    return res.json({
      content: result.response,
      type: type,
      model: result.model,
      tokens_used: tokensUsed
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
