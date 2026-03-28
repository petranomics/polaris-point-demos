// Polaris Point — Config Engine
// Reads window.SITE_CONFIG and injects values into elements with data-cfg attributes.
// Supports ?preview= URL param for live previewing from admin intake form.
// Fails silently if no config is found (HTML defaults remain visible).
(function() {
  'use strict';

  // Check for localStorage config override (from per-site admin editor)
  try {
    var demoPath = location.pathname.split('/').filter(Boolean)[0] || '';
    if (demoPath && demoPath !== 'admin') {
      var stored = localStorage.getItem('pp_config_' + demoPath);
      if (stored) {
        window.SITE_CONFIG = JSON.parse(stored);
      }
    }
  } catch(e) { /* fall back to config.js */ }

  // Check for preview config in URL
  try {
    var params = new URLSearchParams(window.location.search);

    // Short preview link: ?p=gistId — fetch config from API
    var previewId = params.get('p');
    if (previewId) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', '/api/preview?id=' + previewId, false); // synchronous
      xhr.send();
      if (xhr.status === 200) {
        var data = JSON.parse(xhr.responseText);
        if (data.config) {
          var fn0 = new Function(data.config + '\nreturn SITE_CONFIG;');
          window.SITE_CONFIG = fn0();
        }
      }
    }

    // Legacy: base64 preview or localStorage preview
    var preview = params.get('preview');
    if (preview === 'local') {
      var stored2 = localStorage.getItem('pp_preview_config');
      if (stored2) {
        var fn = new Function(stored2 + '\nreturn SITE_CONFIG;');
        window.SITE_CONFIG = fn();
      }
    } else if (preview && preview !== 'local') {
      var decoded = decodeURIComponent(escape(atob(preview)));
      var fn2 = new Function(decoded + '\nreturn SITE_CONFIG;');
      window.SITE_CONFIG = fn2();
    }
  } catch(e) { console.warn('Preview config parse error:', e); }

  var C = window.SITE_CONFIG;
  if (!C) return;

  // 0. Apply theme overrides (colors, fonts, logo) via CSS custom properties
  if (C.theme) {
    var T = C.theme;
    var root = document.documentElement;
    if (T.primary) { root.style.setProperty('--pp-primary', T.primary); root.style.setProperty('--navy', T.primary); }
    if (T.primaryDark) { root.style.setProperty('--pp-primary-dark', T.primaryDark); root.style.setProperty('--navy-dark', T.primaryDark); }
    if (T.accent) { root.style.setProperty('--pp-accent', T.accent); root.style.setProperty('--orange', T.accent); root.style.setProperty('--accent', T.accent); }
    if (T.accentLight) { root.style.setProperty('--pp-accent-light', T.accentLight); root.style.setProperty('--orange-light', T.accentLight); }
    if (T.bg) { root.style.setProperty('--pp-bg', T.bg); root.style.setProperty('--light', T.bg); }
    if (T.text) { root.style.setProperty('--pp-text', T.text); root.style.setProperty('--text', T.text); }
    if (T.muted) { root.style.setProperty('--pp-muted', T.muted); root.style.setProperty('--muted', T.muted); }
    if (T.fontHeading) root.style.setProperty('--pp-font-heading', T.fontHeading);
    if (T.fontBody) root.style.setProperty('--pp-font-body', T.fontBody);
    // Apply header/nav background color
    var header = document.querySelector('.site-header') || document.querySelector('header');
    if (header && T.primary) header.style.background = 'rgba(' + parseInt(T.primary.slice(1,3),16) + ',' + parseInt(T.primary.slice(3,5),16) + ',' + parseInt(T.primary.slice(5,7),16) + ',.97)';
    var topbar = document.querySelector('.topbar');
    if (topbar && T.primaryDark) topbar.style.background = T.primaryDark;
    // Apply body font
    if (T.fontBody) document.body.style.fontFamily = T.fontBody;
    // Apply heading font to all headings
    if (T.fontHeading) {
      document.querySelectorAll('h1,h2,h3,h4').forEach(function(h) { h.style.fontFamily = T.fontHeading; });
    }
    // Inject logo image if provided
    if (T.logoUrl) {
      // Nav logo — replace icon with logo image
      var logoEl = document.querySelector('.logo');
      if (logoEl) {
        var logoIcon = logoEl.querySelector('.logo-icon');
        if (logoIcon) {
          logoIcon.style.cssText = 'width:auto;height:34px;background:none;border-radius:0;display:flex;align-items:center;';
          logoIcon.innerHTML = '<img src="' + T.logoUrl + '" alt="Logo" style="height:34px;width:auto;object-fit:contain;">';
        }
      }
      // Hero — prominent logo lockup above the headline
      var heroH1 = document.querySelector('.hero h1, .hero-content h1');
      if (heroH1 && heroH1.parentNode) {
        var lockup = document.createElement('div');
        lockup.style.cssText = 'margin-bottom:20px;';
        var heroLogo = document.createElement('img');
        heroLogo.src = T.logoUrl;
        heroLogo.alt = (C.businessName || 'Logo');
        heroLogo.style.cssText = 'max-height:100px;max-width:320px;object-fit:contain;display:block;filter:drop-shadow(0 4px 12px rgba(0,0,0,.4));';
        lockup.appendChild(heroLogo);
        heroH1.parentNode.insertBefore(lockup, heroH1);
      }
      // Footer logo
      var footerName = document.querySelector('footer h4[data-cfg="businessName"]');
      if (footerName) {
        var footerLogo = document.createElement('img');
        footerLogo.src = T.logoUrl;
        footerLogo.alt = 'Logo';
        footerLogo.style.cssText = 'height:36px;width:auto;object-fit:contain;margin-bottom:10px;display:block;';
        footerName.parentNode.insertBefore(footerLogo, footerName);
      }
    }
    // Apply background color to body
    if (T.bg) document.body.style.background = T.bg;
  }

  // 1. Text injection: data-cfg="key" → element.textContent = config[key]
  document.querySelectorAll('[data-cfg]').forEach(function(el) {
    var key = el.getAttribute('data-cfg');
    if (C[key] !== undefined) {
      if (el.tagName === 'TITLE') {
        document.title = C[key];
      } else {
        el.textContent = C[key];
      }
    }
  });

  // 2. HTML injection (opt-in): data-cfg-html="key" → element.innerHTML
  document.querySelectorAll('[data-cfg-html]').forEach(function(el) {
    var key = el.getAttribute('data-cfg-html');
    if (C[key] !== undefined) el.innerHTML = C[key];
  });

  // 3. Attribute injection: data-cfg-attr="attr1:key1,attr2:key2"
  document.querySelectorAll('[data-cfg-attr]').forEach(function(el) {
    el.getAttribute('data-cfg-attr').split(',').forEach(function(pair) {
      var parts = pair.trim().split(':');
      if (parts.length === 2 && C[parts[1]] !== undefined) {
        el.setAttribute(parts[0], C[parts[1]]);
      }
    });
  });

  // 4. List injection: data-cfg-list="arrayKey"
  document.querySelectorAll('[data-cfg-list]').forEach(function(container) {
    var key = container.getAttribute('data-cfg-list');
    var items = C[key];
    if (!Array.isArray(items) || items.length === 0) return;

    var children = Array.from(container.children);
    if (children.length === 0) return;
    var template = children[0];

    // Adjust child count to match array length
    while (container.children.length > items.length) {
      container.removeChild(container.lastElementChild);
    }
    while (container.children.length < items.length) {
      container.appendChild(template.cloneNode(true));
    }

    var updatedChildren = container.children;
    for (var i = 0; i < items.length; i++) {
      var child = updatedChildren[i];
      var item = items[i];

      // Simple string arrays (e.g., serviceAreas, trustBadges)
      if (typeof item === 'string') {
        var target = child.querySelector('[data-cfg-item]') || child;
        target.textContent = item;
        continue;
      }

      // Object arrays (e.g., services, reviews)
      child.querySelectorAll('[data-cfg-item]').forEach(function(el) {
        var prop = el.getAttribute('data-cfg-item');
        if (item[prop] !== undefined) el.textContent = item[prop];
      });
      child.querySelectorAll('[data-cfg-item-attr]').forEach(function(el) {
        el.getAttribute('data-cfg-item-attr').split(',').forEach(function(pair) {
          var parts = pair.trim().split(':');
          if (parts.length === 2 && item[parts[1]] !== undefined) {
            el.setAttribute(parts[0], item[parts[1]]);
          }
        });
      });
      child.querySelectorAll('[data-cfg-item-html]').forEach(function(el) {
        var prop = el.getAttribute('data-cfg-item-html');
        if (item[prop] !== undefined) el.innerHTML = item[prop];
      });
    }
  });

  // 5. Select options: data-cfg-options="arrayKey"
  document.querySelectorAll('[data-cfg-options]').forEach(function(select) {
    var key = select.getAttribute('data-cfg-options');
    var opts = C[key];
    if (!Array.isArray(opts)) return;
    // Keep the first option (placeholder)
    while (select.options.length > 1) select.remove(select.options.length - 1);
    opts.forEach(function(text) {
      var opt = document.createElement('option');
      opt.textContent = text;
      opt.value = text;
      select.appendChild(opt);
    });
  });
})();
