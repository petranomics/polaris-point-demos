// /home/api-server/agents/outreach-callprep.js
// Generates personalized call scripts with talking points and objection handling
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
    const { lead } = req.body;
    if (!lead || !lead.biz_name) {
      return res.status(400).json({ error: 'Missing required field: lead.biz_name' });
    }

    const hasWebsite = lead.website && lead.website.toLowerCase() !== 'none' && lead.website.trim() !== '';
    const name = lead.contact || 'the owner';
    const biz = lead.biz_name;
    const industry = lead.industry || 'local business';

    const prompt = `You are a sales coach preparing a cold call script for a web design sales rep named Pete from Polaris Point.

Target business: ${biz}
Contact name: ${name}
Industry: ${industry}
Has website: ${hasWebsite ? 'Yes — ' + lead.website : 'No'}
Rating: ${lead.rating || 'unknown'}
Years in business: ${lead.years_in_biz || 'unknown'}
Address: ${lead.address || 'unknown'}

Create a call preparation sheet with:
1. An opening line (natural, not scripted-sounding, references their specific business)
2. 5 talking points relevant to their situation
3. 4 common objections with persuasive but respectful responses
4. A closing statement / CTA

Return ONLY valid JSON, no markdown:
{
  "opening": "...",
  "talking_points": ["...", "...", "...", "...", "..."],
  "objections": [
    {"objection": "...", "response": "..."},
    {"objection": "...", "response": "..."},
    {"objection": "...", "response": "..."},
    {"objection": "...", "response": "..."}
  ],
  "closing": "..."
}`;

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
      // Fallback structure if JSON parse fails
      result = {
        opening: 'Hi ' + name + ', this is Pete from Polaris Point. I work with local ' + industry + ' businesses to help them get found online.',
        talking_points: [
          '97% of customers search online before calling',
          response.data.response.substring(0, 200)
        ],
        objections: [
          { objection: 'Not interested', response: 'Totally understand. Mind if I send a quick demo link? No follow-up unless you reach out.' }
        ],
        closing: 'Would it help if I sent you a link to see what your site could look like?',
        _parse_warning: 'LLM output was not valid JSON, using fallback'
      };
    }

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
    res.json({ status: 'healthy', agent: 'outreach-callprep', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'unhealthy', agent: 'outreach-callprep', error: 'Ollama unreachable' });
  }
};

module.exports = { verifyKey, handler, healthCheck };
