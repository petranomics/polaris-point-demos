// Polaris Point — Schema Generator
// Auto-generates JSON-LD structured data from SITE_CONFIG
// Injects into <head> for SEO + LLM discoverability
(function() {
  'use strict';
  var C = window.SITE_CONFIG;
  if (!C) return;

  function inject(obj) {
    var script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(obj);
    document.head.appendChild(script);
  }

  // ── 1. LocalBusiness Schema ──────────────────────────────────────────
  var biz = {
    '@context': 'https://schema.org',
    '@type': (C.schema && C.schema.additionalType) || (C.schema && C.schema.type) || 'LocalBusiness',
    name: C.businessName || '',
    url: C.canonicalUrl || window.location.origin + window.location.pathname,
    telephone: C.phone || '',
    email: C.email || '',
    description: C.metaDescription || C.heroSubtext || '',
    image: C.heroImage || C.ogImage || '',
    logo: (C.theme && C.theme.logoUrl) || '',
    priceRange: (C.schema && C.schema.priceRange) || '$$'
  };

  // Address
  if (C.address) {
    // Try to parse "123 Main St, Austin, TX 78701" format
    var parts = C.address.split(',').map(function(s) { return s.trim(); });
    biz.address = {
      '@type': 'PostalAddress',
      streetAddress: parts[0] || '',
      addressLocality: parts[1] || (C.geoPlacename || ''),
      addressRegion: (C.geoRegion || '').replace('US-', '') || (parts[2] ? parts[2].replace(/\d{5}.*/, '').trim() : ''),
      postalCode: (parts[2] || '').match(/\d{5}/) ? (parts[2].match(/\d{5}/) || [''])[0] : '',
      addressCountry: 'US'
    };
  }

  // Geo coordinates
  if (C.geoPosition) {
    var coords = C.geoPosition.split(';');
    if (coords.length === 2) {
      biz.geo = {
        '@type': 'GeoCoordinates',
        latitude: parseFloat(coords[0]),
        longitude: parseFloat(coords[1])
      };
    }
  }

  // Opening hours
  if (C.schema && C.schema.openingHours) {
    biz.openingHoursSpecification = C.schema.openingHours.map(function(h) {
      // Parse "Mo-Sa 07:00-19:00" format
      var match = h.match(/^([A-Za-z,-]+)\s+(\d{2}:\d{2})-(\d{2}:\d{2})$/);
      if (!match) return { '@type': 'OpeningHoursSpecification', description: h };
      var dayMap = { Mo: 'Monday', Tu: 'Tuesday', We: 'Wednesday', Th: 'Thursday', Fr: 'Friday', Sa: 'Saturday', Su: 'Sunday' };
      var dayRange = match[1].split('-');
      var days = [];
      if (dayRange.length === 2) {
        var allDays = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
        var start = allDays.indexOf(dayRange[0]);
        var end = allDays.indexOf(dayRange[1]);
        if (start >= 0 && end >= 0) {
          for (var i = start; i <= end; i++) days.push(dayMap[allDays[i]]);
        }
      } else {
        dayRange[0].split(',').forEach(function(d) { if (dayMap[d]) days.push(dayMap[d]); });
      }
      return {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: days,
        opens: match[2],
        closes: match[3]
      };
    });
  }

  // Founded date
  if (C.schema && C.schema.foundingDate) {
    biz.foundingDate = C.schema.foundingDate;
  }

  // Area served
  if (C.schema && C.schema.areaServed && C.schema.areaServed.length) {
    biz.areaServed = C.schema.areaServed.map(function(a) {
      return { '@type': 'City', name: a };
    });
  } else if (C.serviceAreas && C.serviceAreas.length) {
    biz.areaServed = C.serviceAreas.map(function(a) {
      return { '@type': 'City', name: a };
    });
  }

  // Aggregate rating
  if (C.googleReviewsRating && C.googleReviewsCount) {
    biz.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: C.googleReviewsRating,
      reviewCount: C.googleReviewsCount,
      bestRating: '5',
      worstRating: '1'
    };
  }

  // SameAs (social links)
  var sameAs = [];
  if (C.googleReviewsUrl) sameAs.push(C.googleReviewsUrl);
  if (C.schema && C.schema.facebook) sameAs.push(C.schema.facebook);
  if (sameAs.length) biz.sameAs = sameAs;

  inject(biz);

  // ── 2. Service Schemas ───────────────────────────────────────────────
  for (var s = 1; s <= 12; s++) {
    var name = C['service' + s + 'Name'];
    var desc = C['service' + s + 'Desc'];
    if (!name) break;
    inject({
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: name,
      description: desc || '',
      provider: {
        '@type': 'LocalBusiness',
        name: C.businessName || ''
      },
      areaServed: (C.serviceAreas || []).map(function(a) {
        return { '@type': 'City', name: a };
      }),
      serviceType: name
    });
  }

  // ── 3. Review Schemas ────────────────────────────────────────────────
  if (C.reviews && C.reviews.length) {
    C.reviews.forEach(function(r) {
      var author = r.author || r.attribution || 'Customer';
      // Strip HTML entities from attribution
      author = author.replace(/&middot;.*$/, '').replace(/&[^;]+;/g, '').trim();
      inject({
        '@context': 'https://schema.org',
        '@type': 'Review',
        reviewBody: r.text || '',
        author: {
          '@type': 'Person',
          name: author
        },
        reviewRating: {
          '@type': 'Rating',
          ratingValue: r.rating || '5',
          bestRating: '5'
        },
        itemReviewed: {
          '@type': 'LocalBusiness',
          name: C.businessName || ''
        }
      });
    });
  }

  // ── 4. FAQ Schema ────────────────────────────────────────────────────
  if (C.faqs && C.faqs.length) {
    inject({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: C.faqs.map(function(f) {
        return {
          '@type': 'Question',
          name: f.question || f.q || '',
          acceptedAnswer: {
            '@type': 'Answer',
            text: f.answer || f.a || ''
          }
        };
      })
    });
  }

  // ── 5. WebSite Schema ───────────────────────────────────────────────
  inject({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: C.businessName || '',
    url: C.canonicalUrl || window.location.origin,
    description: C.metaDescription || ''
  });

  // ── 6. Open Graph + Twitter Meta Tags ───────────────────────────────
  var ogTags = {
    'og:title': C.pageTitle || C.businessName || '',
    'og:description': C.metaDescription || C.heroSubtext || '',
    'og:image': C.ogImage || C.heroImage || '',
    'og:url': C.canonicalUrl || window.location.href,
    'og:type': 'website',
    'og:site_name': C.businessName || '',
    'twitter:card': 'summary_large_image',
    'twitter:title': C.pageTitle || C.businessName || '',
    'twitter:description': C.metaDescription || '',
    'twitter:image': C.ogImage || C.heroImage || ''
  };

  Object.keys(ogTags).forEach(function(name) {
    if (!ogTags[name]) return;
    // Don't duplicate if already exists
    var existing = document.querySelector('meta[property="' + name + '"], meta[name="' + name + '"]');
    if (existing) return;
    var meta = document.createElement('meta');
    if (name.startsWith('og:')) {
      meta.setAttribute('property', name);
    } else {
      meta.setAttribute('name', name);
    }
    meta.setAttribute('content', ogTags[name]);
    document.head.appendChild(meta);
  });

  // ── 7. Canonical URL ────────────────────────────────────────────────
  if (C.canonicalUrl) {
    var existing = document.querySelector('link[rel="canonical"]');
    if (!existing) {
      var link = document.createElement('link');
      link.rel = 'canonical';
      link.href = C.canonicalUrl;
      document.head.appendChild(link);
    }
  }

  // ── 8. Geo Meta Tags ───────────────────────────────────────────────
  var geoTags = {
    'geo.region': C.geoRegion || '',
    'geo.placename': C.geoPlacename || '',
    'geo.position': C.geoPosition || '',
    'ICBM': C.geoPosition ? C.geoPosition.replace(';', ', ') : ''
  };

  Object.keys(geoTags).forEach(function(name) {
    if (!geoTags[name]) return;
    var existing = document.querySelector('meta[name="' + name + '"]');
    if (existing) return;
    var meta = document.createElement('meta');
    meta.setAttribute('name', name);
    meta.setAttribute('content', geoTags[name]);
    document.head.appendChild(meta);
  });

})();
