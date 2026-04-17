// /api/vps.js — Proxy to Hostinger VPS for LLM and agent tasks
// Routes requests through Vercel so frontends don't call VPS directly.
// Usage:
//   POST /api/vps?action=generate            — content generation via local Ollama
//   POST /api/vps?action=agent/outreach-email — outreach agent
//   GET  /api/vps?action=health              — VPS health check
//   GET  /api/vps?action=agent/outreach-email/health — agent health

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  var vpsBase = process.env.VPS_API_URL;
  var vpsSecret = process.env.VPS_API_SECRET;

  if (!vpsBase || !vpsSecret) {
    return res.status(500).json({ error: 'VPS not configured' });
  }

  // Strip trailing path from VPS_API_URL to get base (e.g. http://72.60.120.245:3000/agent/analyze -> http://72.60.120.245:3000)
  var baseUrl = vpsBase.replace(/\/agent\/.*$/, '').replace(/\/generate$/, '').replace(/\/+$/, '');

  var action = req.query.action || 'health';

  try {
    var endpoint = baseUrl + '/' + action;
    var options = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': vpsSecret,
      },
    };

    if (req.method === 'POST' && req.body) {
      options.body = JSON.stringify(req.body);
    }

    var response = await fetch(endpoint, options);
    var data = await response.json();

    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(502).json({ error: 'VPS unreachable: ' + err.message });
  }
};
