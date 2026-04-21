// Beacon Monitor Agent — VPS-deployed competitor/review monitor
const axios = require('axios');

const OLLAMA_URL = 'http://localhost:11434';

async function handler(req, res) {
  try {
    var body = req.body || {};
    var targets = body.targets || [];
    var context = body.context || '';

    if (!targets.length) {
      return res.status(400).json({ error: 'No monitoring targets provided' });
    }

    var summaries = [];

    for (var i = 0; i < targets.length; i++) {
      var target = targets[i];

      try {
        // Fetch the target URL
        var resp = await axios.get(target.url, {
          headers: { 'User-Agent': 'PolarisPoint-Monitor/1.0' },
          timeout: 10000,
          maxContentLength: 500000
        });

        // Strip HTML to text
        var text = resp.data
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 6000);

        // Summarize with Ollama
        var prompt = target.type === 'competitor'
          ? 'Analyze this competitor website content. Identify: services offered, pricing (if visible), unique selling points, and any recent changes or promotions. Be concise.\n\nWebsite: ' + target.name + '\nContent:\n' + text
          : 'Summarize the reviews and ratings found on this page. Note the overall sentiment, common themes, and any recent reviews. Be concise.\n\nSource: ' + target.name + '\nContent:\n' + text;

        var aiResp = await axios.post(OLLAMA_URL + '/api/chat', {
          model: 'mistral',
          messages: [
            { role: 'system', content: 'You are a business intelligence analyst. Provide concise, actionable summaries.' },
            { role: 'user', content: prompt }
          ],
          stream: false,
          options: { num_predict: 1024, temperature: 0.3 }
        }, { timeout: 30000 });

        summaries.push({
          target: target.name,
          type: target.type,
          summary: aiResp.data.message ? aiResp.data.message.content : 'No summary generated',
          tokens_used: (aiResp.data.prompt_eval_count || 0) + (aiResp.data.eval_count || 0)
        });
      } catch (e) {
        summaries.push({
          target: target.name,
          type: target.type,
          summary: 'Failed to fetch: ' + e.message,
          tokens_used: 0
        });
      }
    }

    var totalTokens = summaries.reduce(function(sum, s) { return sum + s.tokens_used; }, 0);

    return res.json({
      summaries: summaries,
      tokens_used: totalTokens,
      model: 'mistral'
    });
  } catch (err) {
    console.error('Beacon monitor error:', err.message);
    return res.status(500).json({ error: 'Monitoring failed: ' + err.message });
  }
}

function healthCheck(req, res) {
  return res.json({ status: 'ok', agent: 'beacon-monitor' });
}

module.exports = { handler, healthCheck };
