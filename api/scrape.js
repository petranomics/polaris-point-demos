// /api/scrape.js — Scrapes public Yelp page for reviews + data
// Supplements the Yelp API which returns limited review data
// Usage: GET /api/scrape?url=https://www.yelp.com/biz/business-name
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  if (req.method === 'OPTIONS') return res.status(200).end();

  var url = req.query.url;
  if (!url || !url.includes('yelp.com/biz/')) {
    return res.status(400).json({ error: 'Provide a Yelp business URL' });
  }

  try {
    var resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    var html = await resp.text();

    // Extract JSON-LD structured data (richest source)
    var reviews = [];
    var bizData = {};

    // Try to find JSON-LD LocalBusiness schema
    var ldMatches = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || [];
    for (var i = 0; i < ldMatches.length; i++) {
      try {
        var jsonStr = ldMatches[i].replace(/<script type="application\/ld\+json">/, '').replace(/<\/script>/, '');
        var ld = JSON.parse(jsonStr);
        // Handle array of LD objects
        var items = Array.isArray(ld) ? ld : [ld];
        items.forEach(function(item) {
          if (item['@type'] === 'LocalBusiness' || item['@type'] === 'Restaurant' || (item['@type'] && item['@type'].includes && item['@type'].includes('Local'))) {
            bizData.name = item.name || bizData.name;
            bizData.phone = item.telephone || bizData.phone;
            bizData.address = item.address ? [item.address.streetAddress, item.address.addressLocality, item.address.addressRegion, item.address.postalCode].filter(Boolean).join(', ') : bizData.address;
            bizData.rating = item.aggregateRating ? item.aggregateRating.ratingValue : bizData.rating;
            bizData.reviewCount = item.aggregateRating ? item.aggregateRating.reviewCount : bizData.reviewCount;
            bizData.priceRange = item.priceRange || bizData.priceRange;
            if (item.image) bizData.image = item.image;
          }
          if (item['@type'] === 'Review') {
            reviews.push({
              text: item.description || (item.reviewBody) || '',
              author: item.author ? (item.author.name || item.author) : 'Customer',
              rating: item.reviewRating ? item.reviewRating.ratingValue : 5,
              date: item.datePublished || ''
            });
          }
        });
      } catch(e) { /* skip malformed JSON-LD */ }
    }

    // Fallback: extract reviews from HTML patterns
    if (reviews.length === 0) {
      // Yelp uses various patterns; try common ones
      var reviewBlocks = html.match(/"reviewContent":\s*\{[^}]*"text":\s*"([^"]+)"/g) || [];
      reviewBlocks.forEach(function(block) {
        var textMatch = block.match(/"text":\s*"([^"]+)"/);
        if (textMatch) {
          reviews.push({
            text: textMatch[1].replace(/\\n/g, ' ').replace(/\\"/g, '"'),
            author: 'Yelp Reviewer',
            rating: 5,
            date: ''
          });
        }
      });
    }

    // Extract photos from meta tags
    var photos = [];
    var photoMatches = html.match(/content="(https:\/\/s3-media[^"]+\.jpg[^"]*)"/g) || [];
    photoMatches.forEach(function(m) {
      var url = m.match(/content="([^"]+)"/);
      if (url && photos.indexOf(url[1]) === -1) photos.push(url[1]);
    });

    // Also try og:image
    var ogImg = html.match(/<meta property="og:image" content="([^"]+)"/);
    if (ogImg && photos.indexOf(ogImg[1]) === -1) photos.unshift(ogImg[1]);

    return res.status(200).json({
      name: bizData.name || '',
      rating: bizData.rating || null,
      reviewCount: bizData.reviewCount || null,
      phone: bizData.phone || '',
      address: bizData.address || '',
      priceRange: bizData.priceRange || '',
      image: bizData.image || '',
      photos: photos.slice(0, 10),
      reviews: reviews.slice(0, 10),
      source: 'scrape'
    });
  } catch(err) {
    return res.status(500).json({ error: 'Scrape failed: ' + err.message });
  }
};
