// /api/yelp.js — Vercel serverless proxy for Yelp Fusion API
// Usage: GET /api/yelp?q=business+name&location=city+state
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  var query = req.query.q;
  var location = req.query.location;
  if (!query) {
    return res.status(400).json({ error: 'Missing query parameter: q' });
  }

  var apiKey = process.env.YELP_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Yelp API key not configured' });
  }

  try {
    // Search for the business
    var searchUrl = 'https://api.yelp.com/v3/businesses/search'
      + '?term=' + encodeURIComponent(query)
      + (location ? '&location=' + encodeURIComponent(location) : '')
      + '&limit=3';

    var searchResp = await fetch(searchUrl, {
      headers: { 'Authorization': 'Bearer ' + apiKey }
    });
    var searchData = await searchResp.json();

    if (!searchData.businesses || !searchData.businesses.length) {
      return res.status(404).json({ error: 'No Yelp results found', query: query });
    }

    var biz = searchData.businesses[0];

    // Get reviews for the top result
    var reviewsUrl = 'https://api.yelp.com/v3/businesses/' + biz.id + '/reviews?limit=5&sort_by=yelp_sort';
    var reviewsResp = await fetch(reviewsUrl, {
      headers: { 'Authorization': 'Bearer ' + apiKey }
    });
    var reviewsData = await reviewsResp.json();

    var result = {
      name: biz.name || '',
      rating: biz.rating || null,
      reviewCount: biz.review_count || 0,
      phone: biz.display_phone || '',
      address: biz.location ? [biz.location.address1, biz.location.city, biz.location.state, biz.location.zip_code].filter(Boolean).join(', ') : '',
      categories: (biz.categories || []).map(function(c) { return c.title; }),
      imageUrl: biz.image_url || '',
      yelpUrl: biz.url || '',
      reviews: (reviewsData.reviews || []).map(function(r) {
        return {
          text: r.text || '',
          author: r.user ? r.user.name : '',
          rating: r.rating || 5,
          time: r.time_created || ''
        };
      })
    };

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Yelp API request failed: ' + err.message });
  }
};
