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
      social_post: 'Generate 5 social media posts for this business. Mix promotional, educational, and engaging content. Keep each under 280 characters. Format as a numbered list.',
      newsletter: 'Write a monthly newsletter email for this business. Include a greeting, 2-3 short sections with updates/tips, and a call to action. Keep it under 500 words. Tone should match the brand voice.',
      blog: 'Write a blog post (600-800 words) relevant to this business and its customers. Include a compelling title, introduction, 3-4 sections with subheadings, and a conclusion with CTA.',
      email: 'Write a professional marketing email for this business. Include subject line, preview text, body (2-3 paragraphs), and CTA button text.',
      press_release: 'Write a press release for this business. Include headline, dateline, lead paragraph, 2-3 body paragraphs with quotes, boilerplate, and contact info.'
    };

    var userPrompt = prompts[type] || body.custom_prompt || 'Generate marketing content for this business.';
    if (body.custom_prompt) userPrompt = body.custom_prompt;

    // Route to model
    var message = userPrompt;
    var result;

    if (sub.plan === 'pro' && process.env.ANTHROPIC_API_KEY) {
      // Claude direct
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
