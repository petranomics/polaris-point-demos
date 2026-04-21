// Beacon Leads Agent — VPS-deployed lead research (Pro only)
const axios = require('axios');

const OLLAMA_URL = 'http://localhost:11434';

async function handler(req, res) {
  try {
    var body = req.body || {};
    var industry = body.industry || '';
    var location = body.location || '';
    var context = body.context || '';
    var criteria = body.criteria || '';

    if (!industry || !location) {
      return res.status(400).json({ error: 'Missing industry or location' });
    }

    var prompt = [
      'You are a lead research assistant for a small business.',
      'Based on the business context below, identify potential customers or partners.',
      'For each lead, provide: business name, why they would be a good customer, and a suggested outreach approach.',
      'Generate 10 realistic lead ideas based on the industry and location.',
      '',
      '== BUSINESS CONTEXT ==',
      context.substring(0, 4000),
      '',
      '== SEARCH CRITERIA ==',
      'Industry: ' + industry,
      'Location: ' + location,
      criteria ? 'Additional criteria: ' + criteria : '',
      '',
      'Generate 10 lead ideas with specific business types and outreach strategies.'
    ].join('\n');

    var resp = await axios.post(OLLAMA_URL + '/api/chat', {
      model: 'mistral',
      messages: [
        { role: 'system', content: 'You are a B2B lead research specialist. Be specific and actionable.' },
        { role: 'user', content: prompt }
      ],
      stream: false,
      options: { num_predict: 2048, temperature: 0.7 }
    }, { timeout: 45000 });

    var content = resp.data.message ? resp.data.message.content : '';
    var tokensUsed = (resp.data.prompt_eval_count || 0) + (resp.data.eval_count || 0);

    return res.json({
      response: content,
      tokens_used: tokensUsed,
      model: 'mistral'
    });
  } catch (err) {
    console.error('Beacon leads error:', err.message);
    return res.status(500).json({ error: 'Lead research failed: ' + err.message });
  }
}

function healthCheck(req, res) {
  return res.json({ status: 'ok', agent: 'beacon-leads' });
}

module.exports = { handler, healthCheck };
