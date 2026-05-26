/* ============================================
   Polaris Point — Per-Site Visual Admin Editor
   Reads SITE_CONFIG, builds form, saves to localStorage
   ============================================ */
(function() {
  'use strict';

  var PASS_HASH = '89b5785d7fac3b066e5676eccd6051ad41ac2c10ff536fc8600ada7c8ed9123b';
  var demoName = window.PP_DEMO || 'demo';
  var clientSlug = window.PP_CLIENT_SLUG || '';  // Set on deployed client sites
  var useDbConfig = !!clientSlug;                // DB mode vs localStorage mode
  var authHash = '';                             // Stored after successful login
  var STORAGE_KEY = 'pp_config_' + demoName;

  // Preview mode — set when this admin is loaded under a preview URL. Edits
  // are saved back to /api/preview so the same preview link reflects them
  // for prospects.
  var previewId = '';
  var usePreview = false;
  try {
    var qsId = new URLSearchParams(location.search).get('p');
    previewId = qsId || sessionStorage.getItem('pp_preview_id') || window.PP_PREVIEW_ID || '';
    usePreview = !useDbConfig && !!previewId;
  } catch (e) {}

  // In preview mode, fetch the preview's config and let it override SITE_CONFIG
  // before originalConfig snapshots it.
  if (usePreview) {
    try {
      var pxhr = new XMLHttpRequest();
      pxhr.open('GET', '/api/preview?id=' + encodeURIComponent(previewId), false);
      pxhr.send();
      if (pxhr.status === 200) {
        var pdata = JSON.parse(pxhr.responseText);
        if (pdata && pdata.config) {
          var pfn = new Function(pdata.config + '\nreturn SITE_CONFIG;');
          window.SITE_CONFIG = pfn();
        }
      } else {
        usePreview = false; // preview gone — fall back to file/localStorage
      }
    } catch (e) {
      usePreview = false;
    }
  }

  var originalConfig = JSON.parse(JSON.stringify(window.SITE_CONFIG || {}));
  var config = Object.assign({}, originalConfig);

  // Restore auth hash from session (persists across page reloads within tab)
  try { authHash = sessionStorage.getItem('pp_auth_hash') || ''; } catch(e) {}

  // Merge localStorage overrides only in plain demo mode — DB and preview have
  // their own source of truth.
  if (!useDbConfig && !usePreview) {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored) Object.assign(config, JSON.parse(stored));
    } catch(e) {}
  }

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

      // If deployed client site, verify against DB
      if (useDbConfig) {
        fetch('/api/config?action=login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: clientSlug, hash: hash })
        }).then(function(r) { return r.json(); }).then(function(data) {
          if (data.valid) {
            authHash = hash;
            sessionStorage.setItem('pp_site_admin', '1');
            sessionStorage.setItem('pp_auth_hash', hash);
            showEditor();
          } else {
            errEl.style.display = 'block';
          }
        }).catch(function() { errEl.style.display = 'block'; });
        return;
      }

      // Demo mode: check hardcoded hash
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

  // Renders a textarea that collects as a line-separated array. Marked with
  // data-as="lines" so collectConfig() splits/joins automatically.
  function addLinesField(parent, label, key, val, placeholder) {
    var f = el('div', 'sa-field');
    f.appendChild(el('label', '', { text: label }));
    var inp = el('textarea', '', { 'data-key': key, 'data-as': 'lines' });
    if (placeholder) inp.setAttribute('placeholder', placeholder);
    inp.value = Array.isArray(val) ? val.join('\n') : (val || '');
    f.appendChild(inp);
    parent.appendChild(f);
    return inp;
  }

  // Renders a <select> bound to a data-key. options = [{value, label}].
  function addSelect(parent, label, key, options, val) {
    var f = el('div', 'sa-field');
    f.appendChild(el('label', '', { text: label }));
    var sel = el('select', '', { 'data-key': key });
    options.forEach(function(opt) {
      var o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      if (opt.value === val) o.selected = true;
      sel.appendChild(o);
    });
    f.appendChild(sel);
    parent.appendChild(f);
    return sel;
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
      // Parse line-separated textareas into string arrays; checkboxes into bool.
      var asType = inp.getAttribute('data-as');
      var value = inp.value;
      if (asType === 'lines') {
        value = (value || '').split(/\r?\n/).map(function(s) { return s.trim(); }).filter(Boolean);
      } else if (asType === 'bool') {
        value = !!inp.checked;
      }
      // Dotted keys (e.g. "chatbot.persona") become nested objects so the
      // emitted config matches what /api/site-chat.js and /api/site-lead.js
      // expect. Single-level nesting only — keep it simple.
      var dot = key.indexOf('.');
      if (dot !== -1) {
        var parent = key.slice(0, dot);
        var child = key.slice(dot + 1);
        if (!out[parent] || typeof out[parent] !== 'object') out[parent] = {};
        out[parent][child] = value;
        return;
      }
      out[key] = value;
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

    // If deployed client site, save to DB
    if (useDbConfig) {
      var hash = authHash || sessionStorage.getItem('pp_auth_hash') || '';
      fetch('/api/config?slug=' + encodeURIComponent(clientSlug), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: data, hash: hash })
      }).then(function(r) { return r.json(); }).then(function(result) {
        if (result.success) {
          notify('Saved! Changes are live.', 'success');
        } else {
          notify('Save failed: ' + (result.error || 'unknown error'), 'error');
        }
      }).catch(function(err) {
        notify('Save failed: ' + err.message, 'error');
      });
      return;
    }

    // Preview mode: save back to the same preview ID so the link reflects edits
    if (usePreview) {
      var configSrc = 'window.SITE_CONFIG = ' + JSON.stringify(data) + ';';
      fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: previewId,
          config: configSrc,
          template: demoName,
          name: data.businessName || demoName
        })
      }).then(function(r) { return r.json(); }).then(function(result) {
        if (result.id) {
          notify('Preview updated! Reload the site to see changes.', 'success');
        } else {
          notify('Save failed: ' + (result.error || 'unknown error'), 'error');
        }
      }).catch(function(err) {
        notify('Save failed: ' + err.message, 'error');
      });
      return;
    }

    // Demo mode: save to localStorage
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
    var subText = usePreview
      ? 'Editing preview · changes save back to this preview link'
      : (demoName.charAt(0).toUpperCase() + demoName.slice(1) + ' Demo Configuration');
    var sub = el('p', '', { text: subText });
    header.appendChild(sub);
    if (usePreview) {
      var banner = el('div', '', {
        text: 'Preview Mode — edits persist to /api/preview (id: ' + previewId + ')'
      });
      banner.style.cssText = 'margin-top:10px;padding:8px 14px;background:rgba(212,168,83,.08);border:1px solid rgba(212,168,83,.25);border-radius:8px;color:#D4A853;font-size:.78rem;font-weight:600;';
      header.appendChild(banner);
    }
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

    // 12. Notifications & Reporting (universal — all tiers)
    var ops = config.ops || {};
    var sec12 = makeSection('Notifications & Reporting');
    var ops12Note = el('p', '', { text: 'Where leads, alerts, and the monthly performance report get sent. Updates take effect on the next save.' });
    ops12Note.style.cssText = 'font-size:.78rem;color:#94a3b8;margin:-4px 0 12px;';
    sec12.appendChild(ops12Note);
    addFieldRow(sec12, [
      { label: 'Primary lead-notification email', key: 'ops.leadEmail', val: ops.leadEmail || '' },
      { label: 'CC email (optional)', key: 'ops.leadCcEmail', val: ops.leadCcEmail || '' }
    ]);
    addSelect(sec12, 'Lead alert cadence', 'ops.leadAlertCadence', [
      { value: 'instant', label: 'Instant — email per lead' },
      { value: 'daily', label: 'Daily digest (8am)' },
      { value: 'weekly', label: 'Weekly digest (Monday)' }
    ], ops.leadAlertCadence || 'instant');
    addField(sec12, 'Performance report recipient', 'ops.reportEmail', 'text', ops.reportEmail || '');
    addField(sec12, 'Internal notes (never shown publicly)', 'ops.ownerNotes', 'textarea', ops.ownerNotes || '');
    wrap.appendChild(sec12);

    // 13. Chatbot & Brand Voice — only rendered if the chatbot was enabled
    // at deploy time. The build-flow toggle sets chatbot.enabled=true; sites
    // that didn't opt in (Launch-tier clients) never see this section.
    var bot = config.chatbot || {};
    var brand = config.brand || {};
    if (bot.enabled === true) {
    var sec13 = makeSection('Chatbot & Brand Voice');
    var sec13Note = el('p', '', { text: 'Defines how the AI popup chat speaks for your business — and the brand voice that shapes site copy. Only used on Orbit / Apex plans.' });
    sec13Note.style.cssText = 'font-size:.78rem;color:#94a3b8;margin:-4px 0 12px;';
    sec13.appendChild(sec13Note);

    // Master enabled toggle. Mirrors the Step 5 builder toggle. When off,
    // chatbot fields are dimmed/disabled and the saved config sets
    // chatbot.enabled=false, which makes /api/site-chat refuse and the widget
    // skip rendering. Brand voice stays editable since it shapes site copy
    // regardless of whether the chatbot runs.
    var botEnabledRow = el('div', '');
    botEnabledRow.style.cssText = 'background:rgba(91,141,239,.06);border:1px solid rgba(91,141,239,.25);border-radius:8px;padding:12px 14px;margin-bottom:16px;display:flex;align-items:center;gap:10px;';
    var botCb = el('input', '', { type: 'checkbox', id: 'sa-chatbot-enabled', 'data-key': 'chatbot.enabled', 'data-as': 'bool' });
    botCb.style.cssText = 'width:18px;height:18px;cursor:pointer;accent-color:#5B8DEF;';
    if (bot.enabled === true) botCb.checked = true;
    var botCbLabel = el('label', '', { text: 'Enable AI popup chat on this site' });
    botCbLabel.setAttribute('for', 'sa-chatbot-enabled');
    botCbLabel.style.cssText = 'color:#fff;font-size:.85rem;font-weight:600;cursor:pointer;flex:1;';
    botEnabledRow.appendChild(botCb);
    botEnabledRow.appendChild(botCbLabel);
    sec13.appendChild(botEnabledRow);
    // Wrap chatbot-only fields so we can dim them when the toggle is off.
    var botWrap = el('div', '');
    botWrap.style.transition = 'opacity .15s';
    var applyBotEnabledStyle = function() {
      var on = botCb.checked;
      botWrap.style.opacity = on ? '1' : '.4';
      botWrap.style.pointerEvents = on ? 'auto' : 'none';
    };
    botCb.addEventListener('change', applyBotEnabledStyle);
    applyBotEnabledStyle();
    sec13.appendChild(botWrap);
    var botRow = el('div', 'sa-field-row');
    addSelect(botRow, 'Persona', 'chatbot.persona', [
      { value: 'friendly', label: 'Friendly & warm' },
      { value: 'professional', label: 'Professional & concise' },
      { value: 'casual', label: 'Casual & conversational' },
      { value: 'direct', label: 'Direct & no-nonsense' },
      { value: 'enthusiastic', label: 'Enthusiastic & upbeat' }
    ], bot.persona || 'friendly');
    addSelect(botRow, 'Voice', 'chatbot.voice', [
      { value: 'we', label: 'We / our team' },
      { value: 'they', label: 'They / the business' }
    ], bot.voice || 'we');
    botWrap.appendChild(botRow);
    addField(botWrap, 'Custom greeting', 'chatbot.greeting', 'text', bot.greeting || '');
    addLinesField(botWrap, 'Things the bot should NEVER say (one per line)', 'chatbot.neverSay', bot.neverSay,
      "Don't quote prices\nDon't promise same-day service");
    addLinesField(botWrap, 'Things the bot should ALWAYS suggest (one per line)', 'chatbot.alwaysSuggest', bot.alwaysSuggest,
      'Suggest the booking link for appointments\nSuggest calling for emergencies');
    addField(botWrap, 'Extra tone notes (optional)', 'chatbot.notes', 'textarea', bot.notes || '');
    // Brand voice subsection — shapes site copy regardless of whether the chatbot runs
    var brandHeader = el('h3', '', { text: 'Brand voice' });
    brandHeader.style.cssText = 'font-size:.85rem;color:#fff;margin:18px 0 8px;padding-top:14px;border-top:1px solid rgba(91,141,239,.14);';
    sec13.appendChild(brandHeader);
    addField(sec13, 'Target customer', 'brand.targetCustomer', 'text', brand.targetCustomer || '');
    addLinesField(sec13, 'Key differentiators (one per line)', 'brand.differentiators', brand.differentiators,
      'Family-owned since 2008\n24/7 emergency service\nLifetime warranty');
    addField(sec13, 'Brand voice notes', 'brand.voiceNotes', 'textarea', brand.voiceNotes || '');
    wrap.appendChild(sec13);
    } // end chatbot.enabled gate

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

// ── BEACON AI CHAT ──────────────────────────────────────────────────────────
(function beaconInit() {
  'use strict';

  var slug = window.PP_DEMO || window.PP_CLIENT_SLUG;
  if (!slug) return;

  var subscription = null; // populated after fetch
  var contextDocs = [];    // list of {id, title} from API
  var chatHistory = [];    // {role, content} for display

  // ── Inject styles ──
  var style = document.createElement('style');
  style.textContent = [
    '.bcn-panel{position:fixed;bottom:0;right:24px;width:420px;max-width:calc(100vw - 48px);z-index:90000;font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;border-radius:12px 12px 0 0;overflow:hidden;box-shadow:0 -4px 24px rgba(0,0,0,.45);transition:transform .25s ease,opacity .2s ease;transform:translateY(calc(100% - 48px))}',
    '.bcn-panel.bcn-open{transform:translateY(0)}',
    '.bcn-panel.bcn-hidden{display:none}',

    '.bcn-header{display:flex;align-items:center;justify-content:space-between;background:#111827;padding:12px 16px;cursor:pointer;user-select:none;border-bottom:1px solid #1e293b}',
    '.bcn-header-left{display:flex;align-items:center;gap:10px}',
    '.bcn-header h3{margin:0;font-size:.85rem;font-weight:600;color:#e2e8f0}',
    '.bcn-badge{font-size:.6rem;font-weight:700;padding:2px 7px;border-radius:9999px;background:#5B8DEF;color:#fff;text-transform:uppercase;letter-spacing:.04em}',
    '.bcn-toggle-icon{color:#94a3b8;font-size:1.1rem;transition:transform .2s}',
    '.bcn-open .bcn-toggle-icon{transform:rotate(180deg)}',

    '.bcn-body{background:#111827;display:flex;flex-direction:column;max-height:0;transition:max-height .25s ease}',
    '.bcn-open .bcn-body{max-height:700px}',

    /* Token bar */
    '.bcn-token-bar{padding:8px 16px;background:#111827;border-bottom:1px solid #1e293b}',
    '.bcn-token-label{font-size:.65rem;color:#94a3b8;margin-bottom:4px;display:flex;justify-content:space-between}',
    '.bcn-token-track{height:6px;background:#1e293b;border-radius:3px;overflow:hidden}',
    '.bcn-token-fill{height:100%;background:#5B8DEF;border-radius:3px;transition:width .3s}',

    /* Quick actions */
    '.bcn-actions{display:flex;gap:6px;padding:10px 16px;flex-wrap:wrap;border-bottom:1px solid #1e293b}',
    '.bcn-action-btn{font-size:.68rem;padding:5px 10px;border:1px solid #2d3748;border-radius:6px;background:#1a1f2e;color:#e2e8f0;cursor:pointer;transition:background .15s,border-color .15s;font-family:inherit}',
    '.bcn-action-btn:hover{background:#5B8DEF;border-color:#5B8DEF;color:#fff}',

    /* Context panel */
    '.bcn-ctx-toggle{font-size:.68rem;padding:6px 16px;color:#5B8DEF;background:none;border:none;cursor:pointer;font-family:inherit;text-align:left;width:100%}',
    '.bcn-ctx-toggle:hover{text-decoration:underline}',
    '.bcn-ctx-panel{padding:0 16px 10px;display:none}',
    '.bcn-ctx-panel.bcn-ctx-open{display:block}',
    '.bcn-ctx-list{list-style:none;margin:0 0 8px;padding:0}',
    '.bcn-ctx-list li{display:flex;align-items:center;justify-content:space-between;font-size:.68rem;color:#cbd5e1;padding:3px 0}',
    '.bcn-ctx-del{background:none;border:none;color:#ef4444;cursor:pointer;font-size:.72rem;padding:0 4px;font-family:inherit}',
    '.bcn-ctx-del:hover{color:#f87171}',
    '.bcn-ctx-row{display:flex;gap:6px}',
    '.bcn-ctx-input{flex:1;background:#0B1120;border:1px solid #1e293b;border-radius:6px;padding:6px 8px;color:#e2e8f0;font-size:.72rem;font-family:inherit;resize:vertical;min-height:48px}',
    '.bcn-ctx-add{padding:6px 12px;border:none;border-radius:6px;background:#5B8DEF;color:#fff;font-size:.68rem;cursor:pointer;font-family:inherit;align-self:flex-end}',
    '.bcn-ctx-add:hover{background:#4a7de0}',

    /* Chat thread */
    '.bcn-thread{flex:1;overflow-y:auto;padding:12px 16px;background:#0B1120;display:flex;flex-direction:column;gap:10px;max-height:400px;min-height:120px}',
    '.bcn-msg{max-width:85%;padding:8px 12px;border-radius:10px;font-size:.78rem;line-height:1.45;color:#e2e8f0;word-wrap:break-word;white-space:pre-wrap}',
    '.bcn-msg-user{align-self:flex-end;background:#1e3a5f;border-bottom-right-radius:3px}',
    '.bcn-msg-assistant{align-self:flex-start;background:#1a1f2e;border-bottom-left-radius:3px}',
    '.bcn-msg-error{align-self:center;background:#7f1d1d;font-size:.7rem;color:#fca5a5}',

    /* Typing indicator */
    '.bcn-typing{align-self:flex-start;display:flex;gap:4px;padding:10px 14px;background:#1a1f2e;border-radius:10px;border-bottom-left-radius:3px}',
    '.bcn-dot{width:6px;height:6px;border-radius:50%;background:#5B8DEF;animation:bcnBounce .9s infinite}',
    '.bcn-dot:nth-child(2){animation-delay:.15s}',
    '.bcn-dot:nth-child(3){animation-delay:.3s}',
    '@keyframes bcnBounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-5px)}}',

    /* Input row */
    '.bcn-input-row{display:flex;gap:6px;padding:10px 16px;background:#111827;border-top:1px solid #1e293b}',
    '.bcn-input{flex:1;background:#0B1120;border:1px solid #1e293b;border-radius:8px;padding:8px 12px;color:#e2e8f0;font-size:.78rem;font-family:inherit;outline:none;resize:none;max-height:80px}',
    '.bcn-input:focus{border-color:#5B8DEF}',
    '.bcn-send{padding:8px 14px;border:none;border-radius:8px;background:#5B8DEF;color:#fff;font-size:.78rem;cursor:pointer;font-family:inherit;font-weight:600;transition:background .15s}',
    '.bcn-send:hover{background:#4a7de0}',
    '.bcn-send:disabled{opacity:.5;cursor:not-allowed}'
  ].join('\n');
  document.head.appendChild(style);

  // ── Helpers ──
  function bel(tag, cls, attrs) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (attrs) Object.keys(attrs).forEach(function(k) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    return e;
  }

  // ── Build the Beacon panel ──
  function buildPanel(sub) {
    subscription = sub;

    var panel = bel('div', 'bcn-panel bcn-hidden');
    panel.id = 'beaconPanel';

    // Header
    var header = bel('div', 'bcn-header');
    var hLeft = bel('div', 'bcn-header-left');
    hLeft.appendChild(bel('h3', '', { text: 'Beacon AI' }));
    var planName = (sub.plan_name || sub.plan || 'Lite');
    hLeft.appendChild(bel('span', 'bcn-badge', { text: planName }));
    header.appendChild(hLeft);
    header.appendChild(bel('span', 'bcn-toggle-icon', { html: '&#9660;' }));
    header.onclick = function() { panel.classList.toggle('bcn-open'); };
    panel.appendChild(header);

    // Body wrapper
    var body = bel('div', 'bcn-body');

    // Token usage bar
    var tokenBar = bel('div', 'bcn-token-bar');
    var tokenLabel = bel('div', 'bcn-token-label');
    var used = sub.tokens_used || 0;
    var limit = sub.tokens_limit || 1;
    var pct = Math.min(100, Math.round((used / limit) * 100));
    tokenLabel.innerHTML = '<span>Token Usage</span><span>' + used.toLocaleString() + ' / ' + limit.toLocaleString() + ' (' + pct + '%)</span>';
    tokenBar.appendChild(tokenLabel);
    var track = bel('div', 'bcn-token-track');
    var fill = bel('div', 'bcn-token-fill');
    fill.style.width = pct + '%';
    if (pct > 80) fill.style.background = '#f59e0b';
    if (pct > 95) fill.style.background = '#ef4444';
    track.appendChild(fill);
    tokenBar.appendChild(track);
    body.appendChild(tokenBar);

    // Quick actions
    var actions = bel('div', 'bcn-actions');
    var quickTypes = [
      { label: 'Generate Social Posts', type: 'social_post' },
      { label: 'Draft Newsletter', type: 'newsletter' },
      { label: 'Write Blog Post', type: 'blog' }
    ];
    quickTypes.forEach(function(qt) {
      var btn = bel('button', 'bcn-action-btn', { text: qt.label });
      btn.onclick = function() { doGenerate(qt.type, qt.label); };
      actions.appendChild(btn);
    });
    body.appendChild(actions);

    // Context panel (collapsible)
    var ctxToggle = bel('button', 'bcn-ctx-toggle', { text: '+ Add Context Info' });
    body.appendChild(ctxToggle);
    var ctxPanel = bel('div', 'bcn-ctx-panel');
    var ctxList = bel('ul', 'bcn-ctx-list');
    ctxPanel.appendChild(ctxList);
    var ctxRow = bel('div', 'bcn-ctx-row');
    var ctxInput = bel('textarea', 'bcn-ctx-input', { placeholder: 'Paste additional info about your business (hours, promos, tone notes, etc.)...' });
    ctxRow.appendChild(ctxInput);
    var ctxAddBtn = bel('button', 'bcn-ctx-add', { text: 'Add' });
    ctxRow.appendChild(ctxAddBtn);
    ctxPanel.appendChild(ctxRow);
    body.appendChild(ctxPanel);

    ctxToggle.onclick = function() {
      ctxPanel.classList.toggle('bcn-ctx-open');
      ctxToggle.textContent = ctxPanel.classList.contains('bcn-ctx-open') ? '− Hide Context Info' : '+ Add Context Info';
    };

    ctxAddBtn.onclick = function() {
      var text = ctxInput.value.trim();
      if (!text) return;
      ctxAddBtn.disabled = true;
      fetch('/api/beacon/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription_id: subscription.id, content: text })
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.id) {
          contextDocs.push({ id: data.id, title: text.substring(0, 60) + (text.length > 60 ? '...' : '') });
          renderContextList(ctxList);
          ctxInput.value = '';
        }
      })
      .catch(function() { /* silently fail */ })
      .finally(function() { ctxAddBtn.disabled = false; });
    };

    // Chat thread
    var thread = bel('div', 'bcn-thread');
    thread.id = 'beaconThread';
    body.appendChild(thread);

    // Input row
    var inputRow = bel('div', 'bcn-input-row');
    var chatInput = bel('textarea', 'bcn-input', { placeholder: 'Ask Beacon anything...', rows: '1' });
    chatInput.id = 'beaconInput';
    var sendBtn = bel('button', 'bcn-send', { text: 'Send' });
    sendBtn.id = 'beaconSend';
    inputRow.appendChild(chatInput);
    inputRow.appendChild(sendBtn);
    body.appendChild(inputRow);

    panel.appendChild(body);
    document.body.appendChild(panel);

    // Wire up send
    sendBtn.onclick = function() { doSendMessage(); };
    chatInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        doSendMessage();
      }
    });

    // Auto-resize the input
    chatInput.addEventListener('input', function() {
      chatInput.style.height = 'auto';
      chatInput.style.height = Math.min(chatInput.scrollHeight, 80) + 'px';
    });

    // Show the panel (collapsed by default)
    panel.classList.remove('bcn-hidden');

    // Load existing context docs
    loadContextDocs(ctxList);

    // Greeting
    appendMessage('assistant', 'Hi! I\'m Beacon AI — your content assistant for this site. Ask me anything or use the quick actions above.');
  }

  // ── Render context list ──
  function renderContextList(listEl) {
    listEl.innerHTML = '';
    contextDocs.forEach(function(doc) {
      var li = bel('li', '');
      li.appendChild(bel('span', '', { text: doc.title }));
      var del = bel('button', 'bcn-ctx-del', { text: 'x' });
      del.onclick = function() { deleteContext(doc.id, listEl); };
      li.appendChild(del);
      listEl.appendChild(li);
    });
  }

  // ── Load context docs ──
  function loadContextDocs(listEl) {
    fetch('/api/beacon/context?subscription_id=' + subscription.id)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (Array.isArray(data)) {
          contextDocs = data.map(function(d) {
            return { id: d.id, title: (d.content || d.title || '').substring(0, 60) };
          });
          renderContextList(listEl);
        }
      })
      .catch(function() { /* context endpoint not available */ });
  }

  // ── Delete context doc ──
  function deleteContext(docId, listEl) {
    fetch('/api/beacon/context/' + docId, { method: 'DELETE' })
      .then(function() {
        contextDocs = contextDocs.filter(function(d) { return d.id !== docId; });
        renderContextList(listEl);
      })
      .catch(function() { /* silently fail */ });
  }

  // ── Append a message to the thread ──
  function appendMessage(role, content) {
    var thread = document.getElementById('beaconThread');
    if (!thread) return;
    var cls = role === 'user' ? 'bcn-msg bcn-msg-user'
            : role === 'error' ? 'bcn-msg bcn-msg-error'
            : 'bcn-msg bcn-msg-assistant';
    var msg = bel('div', cls, { text: content });
    thread.appendChild(msg);
    thread.scrollTop = thread.scrollHeight;
    chatHistory.push({ role: role, content: content });
    return msg;
  }

  // ── Typing indicator ──
  function showTyping() {
    var thread = document.getElementById('beaconThread');
    if (!thread) return null;
    var indicator = bel('div', 'bcn-typing');
    indicator.id = 'beaconTyping';
    indicator.appendChild(bel('span', 'bcn-dot'));
    indicator.appendChild(bel('span', 'bcn-dot'));
    indicator.appendChild(bel('span', 'bcn-dot'));
    thread.appendChild(indicator);
    thread.scrollTop = thread.scrollHeight;
    return indicator;
  }

  function hideTyping() {
    var ind = document.getElementById('beaconTyping');
    if (ind) ind.remove();
  }

  // ── Send chat message ──
  function doSendMessage() {
    var input = document.getElementById('beaconInput');
    var sendBtn = document.getElementById('beaconSend');
    if (!input || !sendBtn) return;
    var text = input.value.trim();
    if (!text) return;

    appendMessage('user', text);
    input.value = '';
    input.style.height = 'auto';
    sendBtn.disabled = true;
    var typing = showTyping();

    fetch('/api/beacon/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription_id: subscription.id,
        message: text
      })
    })
    .then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function(data) {
      hideTyping();
      appendMessage('assistant', data.reply || data.message || data.content || 'No response received.');
      updateTokenUsage(data);
    })
    .catch(function(err) {
      hideTyping();
      appendMessage('error', 'Failed to send: ' + err.message);
    })
    .finally(function() {
      sendBtn.disabled = false;
      input.focus();
    });
  }

  // ── Quick generate ──
  function doGenerate(type, label) {
    appendMessage('user', label);
    var sendBtn = document.getElementById('beaconSend');
    if (sendBtn) sendBtn.disabled = true;
    var typing = showTyping();

    fetch('/api/beacon/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription_id: subscription.id,
        type: type
      })
    })
    .then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function(data) {
      hideTyping();
      appendMessage('assistant', data.reply || data.content || data.message || 'Content generated (check your dashboard).');
      updateTokenUsage(data);
    })
    .catch(function(err) {
      hideTyping();
      appendMessage('error', 'Generation failed: ' + err.message);
    })
    .finally(function() {
      if (sendBtn) sendBtn.disabled = false;
    });
  }

  // ── Update token bar after response ──
  function updateTokenUsage(data) {
    if (!data) return;
    var used = data.tokens_used != null ? data.tokens_used : (subscription.tokens_used || 0);
    var limit = data.tokens_limit != null ? data.tokens_limit : (subscription.tokens_limit || 1);
    subscription.tokens_used = used;
    subscription.tokens_limit = limit;
    var pct = Math.min(100, Math.round((used / limit) * 100));
    var label = document.querySelector('.bcn-token-label');
    var fill = document.querySelector('.bcn-token-fill');
    if (label) label.innerHTML = '<span>Token Usage</span><span>' + used.toLocaleString() + ' / ' + limit.toLocaleString() + ' (' + pct + '%)</span>';
    if (fill) {
      fill.style.width = pct + '%';
      fill.style.background = pct > 95 ? '#ef4444' : pct > 80 ? '#f59e0b' : '#5B8DEF';
    }
  }

  // ── Bootstrap: check for subscription ──
  function checkSubscription() {
    fetch('/api/beacon/subscriptions?site_slug=' + encodeURIComponent(slug))
      .then(function(r) {
        if (!r.ok) throw new Error('not found');
        return r.json();
      })
      .then(function(data) {
        // Accept an object or first item in an array
        var sub = Array.isArray(data) ? data[0] : data;
        if (sub && (sub.status === 'active' || sub.active)) {
          buildPanel(sub);
        }
        // else: no active subscription — do nothing
      })
      .catch(function() {
        // API unavailable or no subscription — silently bail
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkSubscription);
  } else {
    checkSubscription();
  }
})();
