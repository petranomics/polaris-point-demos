// Beacon Chat Agent — VPS-deployed conversational AI
// Receives pre-fetched context + history from Vercel, routes to Ollama or Claude
const axios = require('axios');

const OLLAMA_URL = 'http://localhost:11434';

// Estimate tokens (~4 chars per token for English)
function estimateTokens(text) {
  return Math.ceil((text || '').length / 4);
}

// Build system prompt from context documents
function buildSystemPrompt(context, brandVoice) {
  var parts = [
    'You are a helpful marketing assistant for a small business. You know this business inside and out.',
    'Always respond in a professional, friendly tone. Be concise and actionable.',
    'When generating content (social posts, emails, newsletters), match the brand voice described below.',
    'Never make up facts about the business. If you don\'t know something, say so.'
  ];

  if (brandVoice) {
    parts.push('\n== BRAND VOICE ==\n' + brandVoice);
  }

  if (context && context.length > 0) {
    parts.push('\n== BUSINESS CONTEXT ==');
    var totalChars = 0;
    var maxChars = 12000; // ~3K tokens for context
    for (var i = 0; i < context.length && totalChars < maxChars; i++) {
      var doc = context[i];
      var entry = '\n[' + (doc.title || doc.context_type) + ']\n' + doc.content;
      if (totalChars + entry.length > maxChars) {
        entry = entry.substring(0, maxChars - totalChars) + '\n...(truncated)';
      }
      parts.push(entry);
      totalChars += entry.length;
    }
  }

  return parts.join('\n');
}

// Call Ollama (Mistral)
async function callOllama(systemPrompt, messages, userMessage) {
  var ollamaMessages = [{ role: 'system', content: systemPrompt }];

  // Add history (last 10 messages max)
  if (messages && messages.length > 0) {
    var recent = messages.slice(-10);
    recent.forEach(function(m) {
      ollamaMessages.push({ role: m.role, content: m.content });
    });
  }

  ollamaMessages.push({ role: 'user', content: userMessage });

  var resp = await axios.post(OLLAMA_URL + '/api/chat', {
    model: 'mistral',
    messages: ollamaMessages,
    stream: false,
    options: { num_predict: 2048, temperature: 0.7 }
  }, { timeout: 45000 });

  var content = resp.data.message ? resp.data.message.content : '';
  var promptTokens = resp.data.prompt_eval_count || estimateTokens(systemPrompt + userMessage);
  var completionTokens = resp.data.eval_count || estimateTokens(content);

  return {
    response: content,
    tokens_used: promptTokens + completionTokens,
    model: 'mistral'
  };
}

// Call Claude API (for Pro tier)
async function callClaude(systemPrompt, messages, userMessage) {
  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured on VPS');

  var claudeMessages = [];
  if (messages && messages.length > 0) {
    var recent = messages.slice(-20);
    recent.forEach(function(m) {
      if (m.role === 'user' || m.role === 'assistant') {
        claudeMessages.push({ role: m.role, content: m.content });
      }
    });
  }
  claudeMessages.push({ role: 'user', content: userMessage });

  var resp = await axios.post('https://api.anthropic.com/v1/messages', {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    system: systemPrompt,
    messages: claudeMessages
  }, {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    timeout: 30000
  });

  var content = resp.data.content && resp.data.content[0] ? resp.data.content[0].text : '';
  var inputTokens = resp.data.usage ? resp.data.usage.input_tokens : 0;
  var outputTokens = resp.data.usage ? resp.data.usage.output_tokens : 0;

  return {
    response: content,
    tokens_used: inputTokens + outputTokens,
    model: 'claude-haiku-4-5'
  };
}

// Main handler
async function handler(req, res) {
  try {
    var body = req.body || {};
    var message = body.message;
    var context = body.context || [];
    var history = body.history || [];
    var plan = body.plan || 'lite';
    var brandVoice = body.brand_voice || '';

    if (!message) {
      return res.status(400).json({ error: 'Missing message' });
    }

    var systemPrompt = buildSystemPrompt(context, brandVoice);
    var result;

    if (plan === 'pro') {
      result = await callClaude(systemPrompt, history, message);
    } else {
      result = await callOllama(systemPrompt, history, message);
    }

    return res.json(result);
  } catch (err) {
    console.error('Beacon chat error:', err.message);
    return res.status(500).json({
      error: 'Generation failed: ' + err.message,
      tokens_used: 0
    });
  }
}

function healthCheck(req, res) {
  return res.json({ status: 'ok', agent: 'beacon-chat', models: ['mistral', 'claude-haiku'] });
}

module.exports = { handler, healthCheck };
