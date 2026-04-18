// Polaris Point — VPS API Connector
// Include this script on any client site to pull live data from the Polaris backend.
// Requires: window.PP_CLIENT_SLUG set before this script loads.
//
// What it does:
// 1. Calls https://api.polarispoint.io/api/client/{slug}
// 2. Calls https://api.polarispoint.io/api/analytics/{slug}
// 3. Exposes window.PP_CLIENT and window.PP_ANALYTICS for use by the site
// 4. Dispatches a 'polaris:loaded' event when data is ready
//
// Usage in HTML:
//   <script>window.PP_CLIENT_SLUG = 'joes-plumbing';</script>
//   <script src="/shared/polaris-api.js"></script>

(function () {
  'use strict';

  var API_BASE = 'https://api.polarispoint.io';
  var slug = window.PP_CLIENT_SLUG;

  if (!slug) {
    console.warn('[polaris-api] No PP_CLIENT_SLUG set — skipping API load');
    return;
  }

  // Fetch client data + analytics in parallel
  Promise.all([
    fetch(API_BASE + '/api/client/' + slug).then(function (r) { return r.ok ? r.json() : null; }),
    fetch(API_BASE + '/api/analytics/' + slug).then(function (r) { return r.ok ? r.json() : null; }),
  ])
    .then(function (results) {
      var client = results[0];
      var analytics = results[1];

      if (!client) {
        console.warn('[polaris-api] Client not found: ' + slug);
        return;
      }

      window.PP_CLIENT = client;
      window.PP_ANALYTICS = analytics;

      console.log('[polaris-api] Loaded: ' + client.business_name + ' (' + client.plan + ' plan)');

      // If analytics has tracked platforms, log them
      if (analytics && analytics.platforms) {
        analytics.platforms.forEach(function (p) {
          if (p.status === 'tracked') {
            console.log('[polaris-api]   ' + p.platform + '/@' + p.handle + ': ' + (p.followers || 0) + ' followers');
          }
        });
      }

      // Dispatch event so other scripts can react
      window.dispatchEvent(new CustomEvent('polaris:loaded', {
        detail: { client: client, analytics: analytics },
      }));
    })
    .catch(function (err) {
      console.error('[polaris-api] Failed to load:', err.message || err);
    });
})();
