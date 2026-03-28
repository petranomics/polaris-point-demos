/* ============================================
   Polaris Point — Per-Site Visual Admin Editor
   Reads SITE_CONFIG, builds form, saves to localStorage
   ============================================ */
(function() {
  'use strict';

  var PASS_HASH = '89b5785d7fac3b066e5676eccd6051ad41ac2c10ff536fc8600ada7c8ed9123b';
  var demoName = window.PP_DEMO || 'demo';
  var STORAGE_KEY = 'pp_config_' + demoName;
  var originalConfig = JSON.parse(JSON.stringify(window.SITE_CONFIG || {}));
  var config = Object.assign({}, originalConfig);

  // Merge localStorage overrides
  try {
    var stored = localStorage.getItem(STORAGE_KEY);
    if (stored) Object.assign(config, JSON.parse(stored));
  } catch(e) {}

  var THEMES = [
    { id: 'navy-orange', name: 'Professional', desc: 'Navy & Orange', primary: '#1B3A6B', accent: '#E8601E' },
    { id: 'forest-amber', name: 'Earthy', desc: 'Forest & Amber', primary: '#1B4332', accent: '#D4A03C' },
    { id: 'slate-blue', name: 'Modern', desc: 'Slate & Blue', primary: '#1e293b', accent: '#3b82f6' },
    { id: 'charcoal-red', name: 'Bold', desc: 'Charcoal & Red', primary: '#292524', accent: '#dc2626' },
    { id: 'sage-rose', name: 'Boutique', desc: 'Sage & Rose', primary: '#3d5a4c', accent: '#c4988e' },
    { id: 'dark-gold', name: 'Premium', desc: 'Dark & Gold', primary: '#1a1512', accent: '#c8651a' }
  ];
  var selectedThemeId = config.themeId || THEMES[0].id;

  var root = document.getElementById('adminRoot');
  if (!root) { root = document.body; }

  // ── Utility helpers ──
  function el(tag, cls, attrs) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (attrs) Object.keys(attrs).forEach(function(k) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    return e;
  }

  function notify(msg, type) {
    var n = document.querySelector('.sa-notify');
    if (!n) {
      n = el('div', 'sa-notify');
      document.body.appendChild(n);
    }
    n.textContent = msg;
    n.className = 'sa-notify ' + (type || 'success');
    requestAnimationFrame(function() { n.classList.add('visible'); });
    setTimeout(function() { n.classList.remove('visible'); }, 2400);
  }

  // ── Login Gate ──
  function buildLogin() {
    var gate = el('div', 'sa-login-gate');
    var box = el('div', 'sa-login-box');
    box.innerHTML = '<svg class="sa-star" viewBox="0 0 24 24" fill="none"><polygon points="12 1 12.69 10.34 15.18 8.82 13.66 11.31 23 12 13.66 12.69 15.18 15.18 12.69 13.66 12 23 11.31 13.66 8.82 15.18 10.34 12.69 1 12 10.34 11.31 8.82 8.82 11.31 10.34" fill="#5B8DEF" stroke="#5B8DEF" stroke-width="0.3"/></svg>';
    var h2 = el('h2', '', { text: 'Site Editor' });
    var sub = el('p', 'sa-login-sub', { text: demoName + ' admin' });
    var inp = el('input', '', { type: 'password', placeholder: 'Password' });
    var btn = el('button', 'sa-login-btn', { text: 'Sign In' });
    var err = el('p', 'sa-login-error', { text: 'Incorrect password' });

    btn.onclick = function() { doLogin(inp.value, err); };
    inp.onkeydown = function(e) { if (e.key === 'Enter') doLogin(inp.value, err); };

    box.appendChild(h2);
    box.appendChild(sub);
    box.appendChild(inp);
    box.appendChild(btn);
    box.appendChild(err);
    gate.appendChild(box);
    root.appendChild(gate);
    return gate;
  }

  function doLogin(pass, errEl) {
    crypto.subtle.digest('SHA-256', new TextEncoder().encode(pass)).then(function(buf) {
      var hash = Array.from(new Uint8Array(buf)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
      if (hash === PASS_HASH) {
        sessionStorage.setItem('pp_site_admin', '1');
        showEditor();
      } else {
        errEl.style.display = 'block';
      }
    });
  }

  // ── Section builder ──
  var sectionCount = 0;
  function makeSection(title) {
    sectionCount++;
    var sec = el('div', 'sa-section');
    var head = el('div', 'sa-section-head');
    var step = el('span', 'sa-step', { text: String(sectionCount) });
    var h2 = el('h2', '', { text: title });
    head.appendChild(step);
    head.appendChild(h2);
    sec.appendChild(head);
    return sec;
  }

  function addField(parent, label, key, type, val) {
    var f = el('div', 'sa-field');
    var lbl = el('label', '', { text: label });
    f.appendChild(lbl);
    var inp;
    if (type === 'textarea') {
      inp = el('textarea', '', { 'data-key': key });
      inp.value = val || '';
    } else {
      inp = el('input', '', { type: 'text', 'data-key': key });
      inp.value = val || '';
    }
    f.appendChild(inp);
    parent.appendChild(f);
    return inp;
  }

  function addFieldRow(parent, fields) {
    var row = el('div', 'sa-field-row');
    fields.forEach(function(fd) {
      addField(row, fd.label, fd.key, fd.type || 'text', fd.val);
    });
    parent.appendChild(row);
  }

  // ── Auto-crop whitespace/transparency from images ──
  function autoCropImage(src, callback) {
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function() {
      try {
        var c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        var ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        var data = ctx.getImageData(0, 0, c.width, c.height).data;
        var w = c.width, h = c.height;
        var top = h, left = w, right = 0, bottom = 0;
        for (var y = 0; y < h; y++) {
          for (var x = 0; x < w; x++) {
            var i = (y * w + x) * 4;
            var a = data[i+3];
            if (a < 10) continue;
            if (data[i] > 245 && data[i+1] > 245 && data[i+2] > 245) continue;
            if (y < top) top = y;
            if (y > bottom) bottom = y;
            if (x < left) left = x;
            if (x > right) right = x;
          }
        }
        top = Math.max(0, top - 4);
        left = Math.max(0, left - 4);
        right = Math.min(w - 1, right + 4);
        bottom = Math.min(h - 1, bottom + 4);
        var cw = right - left + 1, ch = bottom - top + 1;
        if (cw < 10 || ch < 10) { callback(src); return; }
        var c2 = document.createElement('canvas');
        c2.width = cw; c2.height = ch;
        c2.getContext('2d').drawImage(img, left, top, cw, ch, 0, 0, cw, ch);
        callback(c2.toDataURL('image/png'));
      } catch(e) { callback(src); }
    };
    img.onerror = function() { callback(src); };
    img.src = src;
  }

  // ── Photo zone builder ──
  function addPhotoZone(parent, imgKey, altKey) {
    var zone = el('div', 'sa-photo-zone');
    var preview = el('img', 'sa-photo-preview');
    if (config[imgKey]) {
      preview.src = config[imgKey];
      preview.classList.add('active');
    }
    zone.appendChild(preview);

    var paste = el('div', 'sa-paste-area', { text: 'Paste image (Cmd+V), drag & drop, or enter URL below' });
    zone.appendChild(paste);

    var urlInp = el('input', '', { type: 'text', 'data-key': imgKey, placeholder: 'Image URL...' });
    urlInp.style.cssText = 'width:100%;background:#0B1120;border:1px solid #1e293b;border-radius:8px;padding:8px 12px;color:#e2e8f0;font-family:Inter,sans-serif;font-size:.78rem;outline:none;margin-top:6px;';
    urlInp.value = config[imgKey] || '';
    urlInp.addEventListener('input', function() {
      if (urlInp.value) { preview.src = urlInp.value; preview.classList.add('active'); }
      else { preview.classList.remove('active'); }
    });
    zone.appendChild(urlInp);

    addField(zone, 'Alt text', altKey, 'text', config[altKey] || '');

    // Clipboard paste
    paste.addEventListener('click', function() { paste.focus(); });
    paste.setAttribute('tabindex', '0');
    paste.addEventListener('paste', handlePaste);
    zone.addEventListener('paste', handlePaste);

    function handlePaste(e) {
      var items = (e.clipboardData || e.originalEvent.clipboardData).items;
      for (var i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          e.preventDefault();
          var reader = new FileReader();
          reader.onload = function(ev) {
            autoCropImage(ev.target.result, function(cropped) {
              urlInp.value = cropped;
              preview.src = cropped;
              preview.classList.add('active');
            });
          };
          reader.readAsDataURL(items[i].getAsFile());
          return;
        }
      }
    }

    // Drag & drop
    paste.addEventListener('dragover', function(e) { e.preventDefault(); paste.classList.add('dragover'); });
    paste.addEventListener('dragleave', function() { paste.classList.remove('dragover'); });
    paste.addEventListener('drop', function(e) {
      e.preventDefault();
      paste.classList.remove('dragover');
      var file = e.dataTransfer.files[0];
      if (file && file.type.indexOf('image') !== -1) {
        var reader = new FileReader();
        reader.onload = function(ev) {
          autoCropImage(ev.target.result, function(cropped) {
            urlInp.value = cropped;
            preview.src = cropped;
            preview.classList.add('active');
          });
        };
        reader.readAsDataURL(file);
      }
    });

    parent.appendChild(zone);
  }

  // ── Dynamic list builder ──
  function addDynamicList(parent, listId, fields, items, addLabel) {
    var container = el('div', '', { id: listId });
    parent.appendChild(container);

    function addRow(data) {
      var item = el('div', 'sa-list-item');
      var rm = el('button', 'sa-remove-btn', { text: 'Remove' });
      rm.onclick = function() { item.remove(); };
      item.appendChild(rm);
      fields.forEach(function(fd) {
        addField(item, fd.label, listId + '_' + fd.key, fd.type || 'text', data ? data[fd.key] : '');
      });
      container.appendChild(item);
    }

    (items || []).forEach(function(d) { addRow(d); });

    var addBtn = el('button', 'sa-add-btn', { html: '+ ' + (addLabel || 'Add Item') });
    addBtn.onclick = function() { addRow(null); };
    parent.appendChild(addBtn);

    return container;
  }

  // ── Collect form data ──
  function collectConfig() {
    var out = Object.assign({}, originalConfig);

    // All simple fields
    root.querySelectorAll('[data-key]').forEach(function(inp) {
      var key = inp.getAttribute('data-key');
      // Skip list items (handled separately)
      if (key.indexOf('reviewsList_') === 0 || key.indexOf('faqsList_') === 0 || key.indexOf('servicesList_') === 0) return;
      out[key] = inp.value;
    });

    // Auto-derive
    if (out.phone) {
      out.phoneTelHref = 'tel:+' + out.phone.replace(/\D/g, '');
    }
    if (out.email) {
      out.emailHref = 'mailto:' + out.email;
    }

    // Services (dynamic list -> numbered keys)
    var svcItems = root.querySelectorAll('#servicesList .sa-list-item');
    // Clear old service keys
    for (var i = 1; i <= 12; i++) { delete out['service' + i + 'Name']; delete out['service' + i + 'Desc']; }
    svcItems.forEach(function(item, idx) {
      var n = idx + 1;
      var inputs = item.querySelectorAll('input, textarea');
      out['service' + n + 'Name'] = inputs[0] ? inputs[0].value : '';
      out['service' + n + 'Desc'] = inputs[1] ? inputs[1].value : '';
    });

    // Reviews (dynamic list -> array)
    var revItems = root.querySelectorAll('#reviewsList .sa-list-item');
    out.reviews = [];
    revItems.forEach(function(item) {
      var inputs = item.querySelectorAll('input, textarea');
      out.reviews.push({ text: inputs[0] ? inputs[0].value : '', attribution: inputs[1] ? inputs[1].value : '' });
    });

    // FAQs (dynamic list -> array)
    var faqItems = root.querySelectorAll('#faqsList .sa-list-item');
    out.faqs = [];
    faqItems.forEach(function(item) {
      var inputs = item.querySelectorAll('input, textarea');
      out.faqs.push({ question: inputs[0] ? inputs[0].value : '', answer: inputs[1] ? inputs[1].value : '' });
    });

    // Service areas (comma-separated textarea)
    var saInp = root.querySelector('[data-key="serviceAreasText"]');
    if (saInp) {
      out.serviceAreas = saInp.value.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
      delete out.serviceAreasText;
    }

    // Theme
    out.themeId = selectedThemeId;

    // Family section toggle
    var famCheck = root.querySelector('#familyEnabled');
    if (famCheck) {
      out.familyEnabled = famCheck.checked;
    }

    return out;
  }

  // ── Save / Export / Reset ──
  function doSave() {
    var data = collectConfig();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      notify('Saved! Reload the demo site to see changes.', 'success');
    } catch(e) {
      notify('Error saving: ' + e.message, 'error');
    }
  }

  function doExport() {
    var data = collectConfig();
    var str = '// ' + (data.businessName || demoName) + ' — Site Configuration\n';
    str += '// Generated by Polaris Point Site Editor\n';
    str += 'window.SITE_CONFIG = ' + JSON.stringify(data, null, 2) + ';\n';
    var blob = new Blob([str], { type: 'text/javascript' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'config.js';
    a.click();
    URL.revokeObjectURL(a.href);
    notify('Config downloaded as config.js', 'success');
  }

  function doReset() {
    if (!confirm('Reset to original config.js? This will clear all local edits.')) return;
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  }

  // ── Parse pasted reviews ──
  function parseReviews(text) {
    var reviews = [];
    // Split on double newlines or numbered patterns
    var blocks = text.split(/\n{2,}|(?=\d+\.\s)/).filter(function(b) { return b.trim(); });
    blocks.forEach(function(block) {
      var lines = block.trim().split('\n').map(function(l) { return l.replace(/^\d+\.\s*/, '').trim(); }).filter(Boolean);
      if (lines.length >= 2) {
        reviews.push({ text: lines.slice(0, -1).join(' '), attribution: lines[lines.length - 1] });
      } else if (lines.length === 1) {
        reviews.push({ text: lines[0], attribution: '' });
      }
    });
    return reviews;
  }

  // ── Build Editor ──
  function buildEditor() {
    var wrap = el('div', 'sa-admin-wrap');

    // Header
    var header = el('div', 'sa-header');
    header.innerHTML = '<h1>Site Editor</h1>';
    var sub = el('p', '', { text: demoName.charAt(0).toUpperCase() + demoName.slice(1) + ' Demo Configuration' });
    header.appendChild(sub);
    wrap.appendChild(header);

    // 1. Business Info
    var sec1 = makeSection('Business Info');
    addField(sec1, 'Business Name', 'businessName', 'text', config.businessName);
    addField(sec1, 'Short Name', 'businessNameShort', 'text', config.businessNameShort);
    addFieldRow(sec1, [
      { label: 'Phone', key: 'phone', val: config.phone },
      { label: 'Email', key: 'email', val: config.email }
    ]);
    addField(sec1, 'Address', 'address', 'text', config.address);
    addFieldRow(sec1, [
      { label: 'Hours', key: 'hours', val: config.hours },
      { label: 'License Number', key: 'licenseNumber', val: config.licenseNumber }
    ]);
    wrap.appendChild(sec1);

    // 2. Photos
    var sec2 = makeSection('Photos');
    var photoFields = [
      { img: 'heroImage', alt: 'heroImageAlt', label: 'Hero Image' },
      { img: 'aboutImage', alt: 'aboutImageAlt', label: 'About Image' },
      { img: 'familyPhoto', alt: 'familyPhotoAlt', label: 'Family / Team Photo' },
      { img: 'serviceAreaImage', alt: 'serviceAreaImageAlt', label: 'Service Area Image' }
    ];
    photoFields.forEach(function(pf) {
      var lbl = el('label', '', { text: pf.label });
      lbl.style.cssText = 'display:block;font-size:.7rem;font-weight:600;color:#fff;margin-bottom:6px;margin-top:12px;';
      sec2.appendChild(lbl);
      addPhotoZone(sec2, pf.img, pf.alt);
    });
    wrap.appendChild(sec2);

    // 3. Hero Section
    var sec3 = makeSection('Hero Section');
    addField(sec3, 'Headline', 'heroHeadline', 'text', config.heroHeadline);
    addField(sec3, 'Subtext', 'heroSubtext', 'textarea', config.heroSubtext);
    addFieldRow(sec3, [
      { label: 'CTA Button 1', key: 'heroCta1', val: config.heroCta1 },
      { label: 'CTA Button 2', key: 'heroCta2', val: config.heroCta2 }
    ]);
    wrap.appendChild(sec3);

    // 4. Stats
    var sec4 = makeSection('Stats Bar');
    for (var s = 1; s <= 4; s++) {
      addFieldRow(sec4, [
        { label: 'Stat ' + s + ' Number', key: 'stat' + s + 'Number', val: config['stat' + s + 'Number'] },
        { label: 'Stat ' + s + ' Label', key: 'stat' + s + 'Label', val: config['stat' + s + 'Label'] }
      ]);
    }
    wrap.appendChild(sec4);

    // 5. About
    var sec5 = makeSection('About Section');
    addField(sec5, 'Title', 'aboutTitle', 'text', config.aboutTitle);
    addField(sec5, 'Text', 'aboutText', 'textarea', config.aboutText);
    for (var w = 1; w <= 3; w++) {
      addFieldRow(sec5, [
        { label: 'Why ' + w + ' Title', key: 'why' + w + 'Title', val: config['why' + w + 'Title'] },
        { label: 'Why ' + w + ' Text', key: 'why' + w + 'Text', val: config['why' + w + 'Text'] }
      ]);
    }
    wrap.appendChild(sec5);

    // 6. Services (dynamic)
    var sec6 = makeSection('Services');
    var svcData = [];
    for (var si = 1; si <= 12; si++) {
      if (config['service' + si + 'Name']) {
        svcData.push({ name: config['service' + si + 'Name'], desc: config['service' + si + 'Desc'] || '' });
      }
    }
    addDynamicList(sec6, 'servicesList',
      [{ key: 'name', label: 'Service Name' }, { key: 'desc', label: 'Description', type: 'textarea' }],
      svcData, 'Add Service'
    );
    wrap.appendChild(sec6);

    // 7. Reviews (dynamic)
    var sec7 = makeSection('Reviews');
    addDynamicList(sec7, 'reviewsList',
      [{ key: 'text', label: 'Review Text', type: 'textarea' }, { key: 'attribution', label: 'Attribution' }],
      config.reviews || [], 'Add Review'
    );
    // Paste reviews button
    var pasteBtn = el('button', 'sa-add-btn', { html: 'Paste Reviews' });
    pasteBtn.style.marginLeft = '8px';
    pasteBtn.onclick = function() {
      var text = prompt('Paste reviews (separate with blank lines, last line of each = attribution):');
      if (!text) return;
      var parsed = parseReviews(text);
      var container = root.querySelector('#reviewsList');
      parsed.forEach(function(r) {
        var item = el('div', 'sa-list-item');
        var rm = el('button', 'sa-remove-btn', { text: 'Remove' });
        rm.onclick = function() { item.remove(); };
        item.appendChild(rm);
        addField(item, 'Review Text', 'reviewsList_text', 'textarea', r.text);
        addField(item, 'Attribution', 'reviewsList_attribution', 'text', r.attribution);
        container.appendChild(item);
      });
      notify(parsed.length + ' review(s) added', 'success');
    };
    sec7.appendChild(pasteBtn);
    wrap.appendChild(sec7);

    // 8. FAQs (dynamic)
    var sec8 = makeSection('FAQs');
    addDynamicList(sec8, 'faqsList',
      [{ key: 'question', label: 'Question' }, { key: 'answer', label: 'Answer', type: 'textarea' }],
      config.faqs || [], 'Add FAQ'
    );
    wrap.appendChild(sec8);

    // 9. Service Areas
    var sec9 = makeSection('Service Areas');
    addField(sec9, 'Areas (comma-separated)', 'serviceAreasText', 'textarea',
      (config.serviceAreas || []).join(', '));
    wrap.appendChild(sec9);

    // 10. Theme
    var sec10 = makeSection('Theme');
    var grid = el('div', 'sa-theme-grid');
    THEMES.forEach(function(t) {
      var card = el('div', 'sa-theme-card' + (t.id === selectedThemeId ? ' active' : ''));
      var swatches = el('div', 'sa-theme-swatches');
      var sw1 = el('div', 'sa-swatch'); sw1.style.background = t.primary;
      var sw2 = el('div', 'sa-swatch'); sw2.style.background = t.accent;
      swatches.appendChild(sw1);
      swatches.appendChild(sw2);
      card.appendChild(swatches);
      card.appendChild(el('div', 'sa-theme-name', { text: t.name }));
      card.appendChild(el('div', 'sa-theme-desc', { text: t.desc }));
      card.onclick = function() {
        selectedThemeId = t.id;
        grid.querySelectorAll('.sa-theme-card').forEach(function(c) { c.classList.remove('active'); });
        card.classList.add('active');
      };
      grid.appendChild(card);
    });
    sec10.appendChild(grid);
    wrap.appendChild(sec10);

    // 11. Family Section
    var sec11 = makeSection('Family / Team Section');
    var toggleRow = el('div', 'sa-toggle-row');
    var famCheck = el('input', '', { type: 'checkbox', id: 'familyEnabled' });
    famCheck.checked = !!config.familyEnabled;
    var famLabel = el('label', '', { text: 'Enable family / team photo section' });
    famLabel.setAttribute('for', 'familyEnabled');
    toggleRow.appendChild(famCheck);
    toggleRow.appendChild(famLabel);
    sec11.appendChild(toggleRow);
    addField(sec11, 'Section Title', 'familyTitle', 'text', config.familyTitle || '');
    addField(sec11, 'Section Text', 'familyText', 'textarea', config.familyText || '');
    wrap.appendChild(sec11);

    // Sticky save bar
    var bar = el('div', 'sa-save-bar');
    var saveBtn = el('button', 'sa-btn sa-btn-primary', { text: 'Save Changes' });
    saveBtn.onclick = doSave;
    var exportBtn = el('button', 'sa-btn sa-btn-secondary', { text: 'Export config.js' });
    exportBtn.onclick = doExport;
    var resetBtn = el('button', 'sa-btn sa-btn-danger', { text: 'Reset' });
    resetBtn.onclick = doReset;
    bar.appendChild(saveBtn);
    bar.appendChild(exportBtn);
    bar.appendChild(resetBtn);

    root.appendChild(wrap);
    root.appendChild(bar);
  }

  // ── Show editor (after login) ──
  function showEditor() {
    root.innerHTML = '';
    buildEditor();
  }

  // ── Init ──
  function init() {
    if (sessionStorage.getItem('pp_site_admin') === '1') {
      showEditor();
    } else {
      buildLogin();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
