// Polaris Point — Config Engine
// Reads window.SITE_CONFIG and injects values into elements with data-cfg attributes.
// Fails silently if no config is found (HTML defaults remain visible).
(function() {
  'use strict';
  var C = window.SITE_CONFIG;
  if (!C) return;

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
