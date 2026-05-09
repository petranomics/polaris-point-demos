// /api/places-search.js — Google Places text search, returns up to ~20 results.
// Auto-fetches contact details (phone/website/hours) for every result via the
// Place Details endpoint so the initial scrape isn't missing fields that the
// textsearch payload doesn't include. Set ?details=false to skip and save quota.
//
// Usage: GET /api/places-search?q=plumber+austin+tx[&details=false]
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  if (req.method === 'OPTIONS') return res.status(200).end();

  var query = req.query.q;
  if (!query) return res.status(400).json({ error: 'Missing query parameter: q' });

  var apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Google Places API key not configured' });

  var withDetails = req.query.details !== 'false';

  async function fetchDetails(placeId) {
    if (!placeId) return {};
    var url = 'https://maps.googleapis.com/maps/api/place/details/json'
      + '?place_id=' + placeId
      // Contact + Atmosphere field masks only — keeps Place Details cost low
      // versus pulling the full payload (which we only need on Enrich anyway).
      + '&fields=formatted_phone_number,international_phone_number,website,opening_hours'
      + '&key=' + apiKey;
    try {
      var r = await fetch(url);
      var d = await r.json();
      return d.result || {};
    } catch (e) {
      return {};
    }
  }

  try {
    var url = 'https://maps.googleapis.com/maps/api/place/textsearch/json'
      + '?query=' + encodeURIComponent(query)
      + '&key=' + apiKey;

    var resp = await fetch(url);
    var data = await resp.json();

    if (!data.results || !data.results.length) {
      return res.status(200).json({
        results: [],
        count: 0,
        status: data.status || 'ZERO_RESULTS',
        debug: data.error_message || null
      });
    }

    var open = data.results.filter(function(p) { return p.business_status !== 'CLOSED_PERMANENTLY'; });

    // Parallel detail fetches so the response isn't 20×500ms serially.
    var detailsList = withDetails
      ? await Promise.all(open.map(function(p) { return fetchDetails(p.place_id); }))
      : open.map(function() { return {}; });

    var results = open.map(function(p, i) {
      var det = detailsList[i] || {};
      return {
        name: p.name || '',
        address: p.formatted_address || p.vicinity || '',
        rating: p.rating || null,
        reviewCount: p.user_ratings_total || 0,
        placeId: p.place_id,
        mapsUrl: p.place_id ? 'https://www.google.com/maps/place/?q=place_id:' + p.place_id : '',
        types: p.types || [],
        status: p.business_status || 'OPERATIONAL',
        phone: det.formatted_phone_number || det.international_phone_number || null,
        website: det.website || null,
        hours: (det.opening_hours && det.opening_hours.weekday_text) || []
      };
    });

    return res.status(200).json({
      results: results,
      count: results.length,
      nextPageToken: data.next_page_token || null,
      enriched: withDetails
    });
  } catch (err) {
    return res.status(500).json({ error: 'API request failed: ' + err.message });
  }
};
