// /api/places-search.js — Google Places text search, returns up to ~20 results
// Usage: GET /api/places-search?q=plumber+austin+tx
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  if (req.method === 'OPTIONS') return res.status(200).end();

  var query = req.query.q;
  if (!query) return res.status(400).json({ error: 'Missing query parameter: q' });

  var apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Google Places API key not configured' });

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

    var results = data.results
      .filter(function(p) { return p.business_status !== 'CLOSED_PERMANENTLY'; })
      .map(function(p) {
        return {
          name: p.name || '',
          address: p.formatted_address || p.vicinity || '',
          rating: p.rating || null,
          reviewCount: p.user_ratings_total || 0,
          placeId: p.place_id,
          mapsUrl: p.place_id ? 'https://www.google.com/maps/place/?q=place_id:' + p.place_id : '',
          types: p.types || [],
          status: p.business_status || 'OPERATIONAL'
        };
      });

    return res.status(200).json({
      results: results,
      count: results.length,
      nextPageToken: data.next_page_token || null
    });
  } catch (err) {
    return res.status(500).json({ error: 'API request failed: ' + err.message });
  }
};
