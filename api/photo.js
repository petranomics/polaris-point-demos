// /api/photo.js — Proxy Google Places photos without exposing API key
// Usage: GET /api/photo?ref=PHOTO_REFERENCE&maxwidth=800
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') return res.status(200).end();

  var ref = req.query.ref;
  var maxwidth = req.query.maxwidth || 800;
  if (!ref) return res.status(400).json({ error: 'Missing ref parameter' });

  var apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  try {
    var url = 'https://maps.googleapis.com/maps/api/place/photo?maxwidth=' + maxwidth + '&photo_reference=' + ref + '&key=' + apiKey;
    var resp = await fetch(url, { redirect: 'follow' });
    // Pipe the image through
    res.setHeader('Content-Type', resp.headers.get('content-type') || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    var buffer = Buffer.from(await resp.arrayBuffer());
    return res.status(200).send(buffer);
  } catch (err) {
    return res.status(500).json({ error: 'Photo fetch failed' });
  }
};
