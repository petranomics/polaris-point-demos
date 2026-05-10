// /api/resolve.js — Resolve short URLs (maps.app.goo.gl, etc.) and best-effort
// pull the business name out of the destination page's metadata.
// Usage: GET /api/resolve?url=https://maps.app.goo.gl/abc123
//   → { resolved: '<final URL>', name?: '<business name>' }
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  if (req.method === 'OPTIONS') return res.status(200).end();

  var url = req.query.url;
  if (!url) return res.status(400).json({ error: 'Missing url parameter' });

  try {
    // GET (not HEAD) so Google's short-URL service actually emits redirects,
    // and a 6s timeout so we never hang the function.
    var resp = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (PolarisPoint URL resolver)' },
      signal: AbortSignal.timeout(6000)
    });
    var resolved = resp.url || url;

    // For destinations without /place/ in the path (CID-style URLs), peek at
    // the HTML title — Google usually emits "Business Name - Google Maps".
    // Some URLs render the title via JavaScript so the server-side fetch
    // only sees the generic "<title>Google Maps</title>" — filter those so
    // we don't feed garbage into the search.
    var name = '';
    try {
      var html = await resp.text();
      var m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (m) {
        var candidate = m[1].replace(/\s*[-|]\s*Google Maps.*$/i, '').trim();
        if (candidate && !/^(google\s*maps?|maps?|google)$/i.test(candidate)) {
          name = candidate;
        }
      }
    } catch (_) { /* ignore — title is best-effort */ }

    // Pull place_id from the resolved URL when present — both ?q=place_id:CID
    // and the !1s0xCID:0xCID hex form. This is the deterministic anchor.
    var placeId = '';
    var pid1 = resolved.match(/[?&]q=place_id:([^&\s]+)/);
    if (pid1) placeId = pid1[1];
    if (!placeId) {
      var pid2 = resolved.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i);
      if (pid2) placeId = pid2[1];
    }

    return res.status(200).json({ resolved: resolved, name: name, placeId: placeId });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to resolve URL', resolved: url });
  }
};
