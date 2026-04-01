// /api/resolve.js — Resolve short URLs (maps.app.goo.gl, etc.)
// Usage: GET /api/resolve?url=https://maps.app.goo.gl/abc123
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  if (req.method === 'OPTIONS') return res.status(200).end();

  var url = req.query.url;
  if (!url) return res.status(400).json({ error: 'Missing url parameter' });

  try {
    var resp = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    return res.status(200).json({ resolved: resp.url || url });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to resolve URL', resolved: url });
  }
};
