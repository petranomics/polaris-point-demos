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

  var mode = req.query.mode || 'detail';
  var limit = Math.min(parseInt(req.query.limit) || 3, 20);

  try {
    // Search for businesses
    var searchUrl = 'https://api.yelp.com/v3/businesses/search'
      + '?term=' + encodeURIComponent(query)
      + (location ? '&location=' + encodeURIComponent(location) : '')
      + '&limit=' + limit;

    var searchResp = await fetch(searchUrl, {
      headers: { 'Authorization': 'Bearer ' + apiKey }
    });
    var searchData = await searchResp.json();

    if (!searchData.businesses || !searchData.businesses.length) {
      return res.status(404).json({ error: 'No Yelp results found', query: query });
    }

    // Search mode: return multiple results for batch scraping
    if (mode === 'search') {
      var results = searchData.businesses.map(function(b) {
        return {
          name: b.name || '',
          phone: b.display_phone || '',
          email: null,
          website: null,
          address: b.location ? [b.location.address1, b.location.city, b.location.state, b.location.zip_code].filter(Boolean).join(', ') : '',
          city: b.location ? b.location.city : '',
          state: b.location ? b.location.state : '',
          rating: b.rating ? b.rating + ' stars (' + (b.review_count || 0) + ' reviews)' : null,
          categories: (b.categories || []).map(function(c) { return c.title; }),
          yelpUrl: b.url || '',
          imageUrl: b.image_url || ''
        };
      });
      return res.status(200).json({ businesses: results, total: searchData.total || results.length });
    }

    // Detail mode (default): return enriched single result
    var biz = searchData.businesses[0];

    // Get reviews (Yelp v3 returns up to 3)
    var reviews = [];
    try {
      var reviewsUrl = 'https://api.yelp.com/v3/businesses/' + biz.id + '/reviews?limit=3&sort_by=yelp_sort';
      var reviewsResp = await fetch(reviewsUrl, {
        headers: { 'Authorization': 'Bearer ' + apiKey }
      });
      var reviewsData = await reviewsResp.json();
      if (reviewsData.reviews) {
        reviews = reviewsData.reviews.map(function(r) {
          return {
            text: r.text || '',
            author: r.user ? r.user.name : '',
            rating: r.rating || 5,
            time: r.time_created ? r.time_created.split(' ')[0] : ''
          };
        });
      }
    } catch(e) {
      // Reviews fetch failed — continue without them
    }

    // Get business details for hours and photos
    var hours = [];
    var photos = [];
    try {
      var detailUrl = 'https://api.yelp.com/v3/businesses/' + biz.id;
      var detailResp = await fetch(detailUrl, {
        headers: { 'Authorization': 'Bearer ' + apiKey }
      });
      var detail = await detailResp.json();
      if (detail.hours && detail.hours[0] && detail.hours[0].open) {
        var dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        hours = detail.hours[0].open.map(function(h) {
          var start = h.start.slice(0,2) + ':' + h.start.slice(2);
          var end = h.end.slice(0,2) + ':' + h.end.slice(2);
          return dayNames[h.day] + ' ' + start + '-' + end;
        });
      }
      if (detail.photos) photos = detail.photos;
    } catch(e) {
      // Detail fetch failed — continue without
    }

    var result = {
      name: biz.name || '',
      rating: biz.rating || null,
      reviewCount: biz.review_count || 0,
      phone: biz.display_phone || '',
      address: biz.location ? [biz.location.address1, biz.location.city, biz.location.state, biz.location.zip_code].filter(Boolean).join(', ') : '',
      city: biz.location ? biz.location.city : '',
      state: biz.location ? biz.location.state : '',
      categories: (biz.categories || []).map(function(c) { return c.title; }),
      imageUrl: biz.image_url || '',
      photos: photos,
      yelpUrl: biz.url || '',
      hours: hours,
      hoursFormatted: hours.join(' | '),
      reviews: reviews
    };

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Yelp API request failed: ' + err.message });
  }
};
