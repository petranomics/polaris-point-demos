// /api/places.js — Vercel serverless proxy for Google Places API
// Usage: GET /api/places?q=business+name+city
module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  var query = req.query.q;
  var explicitPlaceId = req.query.placeId;
  if (!query && !explicitPlaceId) {
    return res.status(400).json({ error: 'Missing query parameter: q or placeId' });
  }

  var apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Google Places API key not configured' });
  }

  try {
    var placeId;

    if (explicitPlaceId) {
      // Caller gave us a place_id from a Google Maps URL — skip the fuzzy
      // findplacefromtext step entirely. This is the deterministic path.
      placeId = explicitPlaceId;
    } else {
      // Step 1: Find Place from text
      var findUrl = 'https://maps.googleapis.com/maps/api/place/findplacefromtext/json'
        + '?input=' + encodeURIComponent(query)
        + '&inputtype=textquery'
        + '&fields=place_id,name,formatted_address'
        + '&key=' + apiKey;

      var findResp = await fetch(findUrl);
      var findData = await findResp.json();

      if (!findData.candidates || !findData.candidates.length) {
        return res.status(404).json({
          error: 'No results found',
          query: query,
          status: findData.status || 'UNKNOWN',
          debug: findData.error_message || null
        });
      }

      placeId = findData.candidates[0].place_id;
    }
    // editorial_summary is an "Atmosphere" SKU field — requesting it on a key
    // without that SKU enabled makes Google reject the whole call. Stick to
    // fields known to work on a Basic + Contact key.
    var detailsUrl = 'https://maps.googleapis.com/maps/api/place/details/json'
      + '?place_id=' + placeId
      + '&fields=name,formatted_address,formatted_phone_number,international_phone_number,website,url,rating,user_ratings_total,opening_hours,reviews,photos,types,business_status'
      + '&key=' + apiKey;

    var detailsResp = await fetch(detailsUrl);
    var detailsData = await detailsResp.json();

    if (!detailsData.result) {
      return res.status(404).json({ error: 'Place details not found' });
    }

    var place = detailsData.result;

    // Build photo URLs through our proxy (keeps API key server-side)
    var photos = [];
    if (place.photos && place.photos.length) {
      photos = place.photos.slice(0, 5).map(function(p) {
        return '/api/photo?ref=' + encodeURIComponent(p.photo_reference) + '&maxwidth=800';
      });
    }

    // Sanitize and return useful fields
    var result = {
      name: place.name || '',
      address: place.formatted_address || '',
      phone: place.formatted_phone_number || '',
      phoneIntl: place.international_phone_number || '',
      website: place.website || '',
      mapsUrl: place.url || '',
      rating: place.rating || null,
      reviewCount: place.user_ratings_total || 0,
      hours: (place.opening_hours && place.opening_hours.weekday_text) || [],
      hoursFormatted: (place.opening_hours && place.opening_hours.weekday_text)
        ? place.opening_hours.weekday_text.join(' | ')
        : '',
      reviews: (place.reviews || []).slice(0, 5).map(function(r) {
        return {
          text: r.text || '',
          author: r.author_name || '',
          rating: r.rating || 5,
          time: r.relative_time_description || ''
        };
      }),
      photos: photos,
      imageUrl: photos[0] || '',
      types: place.types || [],
      editorialSummary: '',
      status: place.business_status || 'OPERATIONAL',
      placeId: placeId
    };

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: 'API request failed: ' + err.message });
  }
};
