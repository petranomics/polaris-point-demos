// Beacon Content Agent — VPS-deployed content generator
// Generates social posts, newsletters, blog drafts via Ollama
const axios = require('axios');

const OLLAMA_URL = 'http://localhost:11434';

async function handler(req, res) {
  try {
    var body = req.body || {};
    var type = body.type || 'social_post';
    var message = body.message || '';
    var context = body.context || '';
    var brandVoice = body.brand_voice || '';

    var systemPrompt = [
      'You are a marketing content creator for a small business.',
      'Create high-quality, engaging content that matches the brand voice.',
      'Be specific to the business — reference their actual services, location, and value props.',
      'Never use generic filler. Every piece of content should feel custom.',
      brandVoice ? '\n== BRAND VOICE ==\n' + brandVoice : '',
      context ? '\n== BUSINESS CONTEXT ==\n' + context.substring(0, 8000) : ''
    ].filter(Boolean).join('\n');

    var resp = await axios.post(OLLAMA_URL + '/api/chat', {
      model: 'mistral',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      stream: false,
      options: { num_predict: 4096, temperature: 0.75 }
    }, { timeout: 60000 });

    var content = resp.data.message ? resp.data.message.content : '';
    var promptTokens = resp.data.prompt_eval_count || Math.ceil(systemPrompt.length / 4);
    var completionTokens = resp.data.eval_count || Math.ceil(content.length / 4);

    return res.json({
      response: content,
      tokens_used: promptTokens + completionTokens,
      model: 'mistral',
      type: type
    });
  } catch (err) {
    console.error('Beacon content error:', err.message);
    return res.status(500).json({ error: 'Content generation failed: ' + err.message });
  }
}

function healthCheck(req, res) {
  return res.json({ status: 'ok', agent: 'beacon-content' });
}

module.exports = { handler, healthCheck };
