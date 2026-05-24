// Polaris Point — Business Automation
// ============================================================================
// One file, two embed modes:
//
//   A) TEMPLATE SITES (our verticals + ops-built sites)
//      config-engine.js already populated window.SITE_CONFIG. We read
//      SITE_CONFIG.automation + SITE_CONFIG.features and switch features on by
//      flag. Just include this script after config-engine.js.
//
//   B) CUSTOM SITES (any platform — WordPress, Squarespace, hand-coded)
//      One line, no SITE_CONFIG needed:
//        <script src="https://polarispoint.io/shared/automation.js"
//                data-pp-slug="joes-plumbing"></script>
//      The script reads its own data-pp-slug, fetches that site's config from
//      /api/config?slug=…, and self-injects every enabled feature. CSS is
//      injected inline, so nothing else is required.
//
// Backend contracts (all relative to where THIS script was served from, so
// custom sites on other domains still call back to polarispoint.io):
//   POST /api/site-chat   { slug, message, history } -> { response }
//   POST /api/site-lead   { slug, name, email, phone, message } -> { ok }
//   (review requests are backend/cron — no visitor-facing UI)
//
// Feature flags (SITE_CONFIG.features.* or config.features.*):
//   booking, aiChat, leadAutoReply
//
// Config block (SITE_CONFIG.automation or config.automation):
//   {
//     calendlyUrl: 'https://calendly.com/biz/30min',
//     chat:        { greeting: 'Ask us anything…' },
//     leadAutoReply: { fromName: 'Crystal Clear', replyText: '…' },
//     businessName: 'Crystal Clear Cleaning'   // falls back to SITE_CONFIG
//   }
// ============================================================================
(function () {
  'use strict';

  // ── Locate our own <script> to read data-pp-slug + derive the API origin ──
  var thisScript = document.currentScript || (function () {
    var s = document.getElementsByTagName('script');
    return s[s.length - 1];
  })();
  var SLUG_ATTR = thisScript ? thisScript.getAttribute('data-pp-slug') : null;
  var API_BASE = '';
  try { API_BASE = thisScript ? new URL(thisScript.src).origin : ''; } catch (e) { API_BASE = ''; }
  // Same-origin template sites: empty API_BASE means relative paths, which is
  // what we want. Custom sites get the absolute polarispoint.io origin.

  // ── Resolve config from whichever source is available ──────────────────
  function resolveConfig(cb) {
    // 1) Explicit override always wins
    if (window.PP_AUTOMATION) {
      return cb(normalize(window.PP_AUTOMATION, window.PP_CLIENT_SLUG || SLUG_ATTR));
    }
    // 2) Template site — config-engine.js already set SITE_CONFIG
    if (window.SITE_CONFIG && (window.SITE_CONFIG.automation || window.SITE_CONFIG.features)) {
      return cb(normalize({
        automation: window.SITE_CONFIG.automation || {},
        features: window.SITE_CONFIG.features || {},
        businessName: window.SITE_CONFIG.businessName
      }, window.PP_CLIENT_SLUG || SLUG_ATTR));
    }
    // 3) Custom site — fetch config by slug
    if (SLUG_ATTR) {
      fetch(API_BASE + '/api/config?slug=' + encodeURIComponent(SLUG_ATTR))
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          var cfg = {};
          if (d && d.config) cfg = typeof d.config === 'string' ? JSON.parse(d.config) : d.config;
          cb(normalize({
            automation: cfg.automation || {},
            features: cfg.features || {},
            businessName: cfg.businessName
          }, SLUG_ATTR));
        })
        .catch(function () { cb(null); });
      return;
    }
    // Nothing to go on
    cb(null);
  }

  function normalize(raw, slug) {
    var a = raw.automation || {};
    return {
      slug: slug || null,
      features: raw.features || {},
      calendlyUrl: a.calendlyUrl || '',
      businessName: a.businessName || raw.businessName || 'us',
      chat: a.chat || {},
      leadAutoReply: a.leadAutoReply || {}
    };
  }

  // ── Tiny DOM helper ──────────────────────────────────────────────────
  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') n.className = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    if (html != null) n.innerHTML = html;
    return n;
  }
  function api(path) { return (API_BASE || '') + path; }

  // ── Self-contained styles (injected once) ─────────────────────────────
  function injectStyles() {
    if (document.getElementById('pp-automation-styles')) return;
    var css =
      '.pp-fab-stack{position:fixed;right:18px;bottom:18px;z-index:2147483000;display:flex;flex-direction:column;gap:12px;align-items:flex-end;font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;}' +
      '.pp-fab{display:inline-flex;align-items:center;gap:8px;border:none;cursor:pointer;border-radius:999px;padding:13px 18px;font-size:14px;font-weight:600;color:#fff;background:#5B8DEF;box-shadow:0 6px 22px rgba(0,0,0,.22);transition:transform .15s,box-shadow .15s;}' +
      '.pp-fab:hover{transform:translateY(-2px);box-shadow:0 10px 28px rgba(0,0,0,.28);}' +
      '.pp-fab.book{background:#E8C547;color:#0B1120;}' +
      '.pp-fab svg{width:18px;height:18px;}' +
      '.pp-modal-back{position:fixed;inset:0;z-index:2147483100;background:rgba(5,13,30,.6);backdrop-filter:blur(3px);display:none;align-items:center;justify-content:center;padding:16px;}' +
      '.pp-modal-back.open{display:flex;}' +
      '.pp-modal{background:#fff;border-radius:16px;width:100%;max-width:480px;max-height:86vh;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(0,0,0,.4);}' +
      '.pp-modal.wide{max-width:640px;height:80vh;}' +
      '.pp-modal-head{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #e6e9ef;font-family:Inter,sans-serif;}' +
      '.pp-modal-head h3{margin:0;font-size:15px;font-weight:700;color:#0B1120;}' +
      '.pp-x{border:none;background:none;font-size:22px;line-height:1;color:#64748b;cursor:pointer;padding:0 4px;}' +
      '.pp-modal-body{flex:1;overflow:auto;}' +
      '.pp-modal-body iframe{width:100%;height:70vh;border:0;display:block;}' +
      // chat
      '.pp-chat{display:flex;flex-direction:column;height:100%;font-family:Inter,sans-serif;}' +
      '.pp-chat-log{flex:1;overflow:auto;padding:16px;display:flex;flex-direction:column;gap:10px;background:#f7f9fc;}' +
      '.pp-msg{max-width:82%;padding:10px 13px;border-radius:13px;font-size:14px;line-height:1.45;white-space:pre-wrap;}' +
      '.pp-msg.bot{align-self:flex-start;background:#fff;border:1px solid #e6e9ef;color:#0B1120;}' +
      '.pp-msg.user{align-self:flex-end;background:#5B8DEF;color:#fff;}' +
      '.pp-msg.typing{align-self:flex-start;color:#64748b;font-style:italic;}' +
      '.pp-chat-form{display:flex;gap:8px;padding:12px;border-top:1px solid #e6e9ef;background:#fff;}' +
      '.pp-chat-form input{flex:1;border:1px solid #cfd6e4;border-radius:10px;padding:11px 13px;font-size:16px;outline:none;font-family:Inter,sans-serif;}' +
      '.pp-chat-form button{border:none;background:#5B8DEF;color:#fff;border-radius:10px;padding:0 16px;font-weight:600;cursor:pointer;}' +
      '.pp-chat-form button:disabled{opacity:.5;cursor:not-allowed;}' +
      // lead success toast
      '.pp-toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:2147483200;background:#0B1120;color:#fff;padding:13px 20px;border-radius:10px;font-family:Inter,sans-serif;font-size:14px;box-shadow:0 10px 30px rgba(0,0,0,.3);opacity:0;transition:opacity .2s;}' +
      '.pp-toast.show{opacity:1;}' +
      '@media (max-width:520px){.pp-modal.wide{height:88vh;}.pp-modal-body iframe{height:78vh;}}';
    var s = el('style', { id: 'pp-automation-styles' });
    s.appendChild(document.createTextNode(css));
    document.head.appendChild(s);
  }

  // ── Shared modal scaffolding ───────────────────────────────────────────
  function makeModal(title, wide) {
    var back = el('div', { class: 'pp-modal-back' });
    var modal = el('div', { class: 'pp-modal' + (wide ? ' wide' : '') });
    var head = el('div', { class: 'pp-modal-head' });
    head.appendChild(el('h3', null, title));
    var x = el('button', { class: 'pp-x', 'aria-label': 'Close' }, '&times;');
    head.appendChild(x);
    var body = el('div', { class: 'pp-modal-body' });
    modal.appendChild(head); modal.appendChild(body); back.appendChild(modal);
    document.body.appendChild(back);
    function close() { back.classList.remove('open'); }
    x.addEventListener('click', close);
    back.addEventListener('click', function (e) { if (e.target === back) close(); });
    return { back: back, body: body, open: function () { back.classList.add('open'); }, close: close };
  }

  function toast(msg) {
    var t = el('div', { class: 'pp-toast' }, msg);
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); });
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 250); }, 3500);
  }

  var ICONS = {
    chat: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4a2 2 0 00-2 2v18l4-4h14a2 2 0 002-2V4a2 2 0 00-2-2z"/></svg>',
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>'
  };

  // ── Feature: Booking (Calendly embed) ──────────────────────────────────
  function initBooking(cfg, stack) {
    if (!cfg.calendlyUrl) { console.warn('[pp-automation] booking on but no calendlyUrl'); return; }
    var btn = el('button', { class: 'pp-fab book' }, ICONS.cal + '<span>Book Now</span>');
    var modal = makeModal('Book an appointment', false);
    var loaded = false;
    btn.addEventListener('click', function () {
      if (!loaded) {
        var url = cfg.calendlyUrl + (cfg.calendlyUrl.indexOf('?') > -1 ? '&' : '?') + 'embed_domain=' + location.hostname + '&embed_type=Inline';
        modal.body.appendChild(el('iframe', { src: url, title: 'Booking calendar' }));
        loaded = true;
      }
      modal.open();
    });
    stack.appendChild(btn);
  }

  // ── Feature: AI popup chat ─────────────────────────────────────────────
  function initChat(cfg, stack) {
    var btn = el('button', { class: 'pp-fab' }, ICONS.chat + '<span>Chat</span>');
    var modal = makeModal('Chat with ' + cfg.businessName, true);
    var history = [];
    var built = false, sending = false;

    var log, form, input, sendBtn;
    function build() {
      var wrap = el('div', { class: 'pp-chat' });
      log = el('div', { class: 'pp-chat-log' });
      form = el('form', { class: 'pp-chat-form' });
      input = el('input', { type: 'text', placeholder: 'Type your question…', autocomplete: 'off' });
      sendBtn = el('button', { type: 'submit' }, 'Send');
      form.appendChild(input); form.appendChild(sendBtn);
      wrap.appendChild(log); wrap.appendChild(form);
      modal.body.appendChild(wrap);
      // Prefer the new `chatbot.greeting` (set in the build-flow intake);
      // fall back to legacy `chat.greeting` for sites built before that field
      // existed, then the name-aware default.
      var greeting = (cfg.chatbot && cfg.chatbot.greeting) || cfg.chat.greeting || ('Hi! Ask me anything about ' + cfg.businessName + '.');
      addMsg('bot', greeting);
      form.addEventListener('submit', onSend);
      built = true;
    }
    function addMsg(role, text) {
      var m = el('div', { class: 'pp-msg ' + role }, '');
      m.textContent = text;
      log.appendChild(m); log.scrollTop = log.scrollHeight;
      return m;
    }
    function onSend(e) {
      e.preventDefault();
      var q = (input.value || '').trim();
      if (!q || sending) return;
      input.value = '';
      addMsg('user', q);
      history.push({ role: 'user', content: q });
      sending = true; sendBtn.disabled = true;
      var typing = addMsg('typing', 'typing…');
      fetch(api('/api/site-chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: cfg.slug, message: q, history: history.slice(-8) })
      })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (res) {
          typing.remove();
          var answer = (res.ok && res.d && res.d.response) ? res.d.response
            : 'Sorry — I had trouble answering just now. Please call us or leave a message and we\'ll get right back to you.';
          addMsg('bot', answer);
          history.push({ role: 'assistant', content: answer });
        })
        .catch(function () {
          typing.remove();
          addMsg('bot', 'Sorry — connection issue. Please try again or reach us directly.');
        })
        .finally(function () { sending = false; sendBtn.disabled = false; input.focus(); });
    }
    btn.addEventListener('click', function () { if (!built) build(); modal.open(); setTimeout(function () { input && input.focus(); }, 60); });
    stack.appendChild(btn);
  }

  // ── Feature: Lead capture auto-reply ───────────────────────────────────
  // Enhances existing contact forms (any <form> containing an email field).
  // Intercepts submit, posts to /api/site-lead (which stores + auto-replies),
  // then shows a confirmation. Falls back to native submit if the post fails.
  function initLeadAutoReply(cfg) {
    var forms = Array.prototype.slice.call(document.querySelectorAll('form'));
    forms.forEach(function (f) {
      if (f.classList.contains('pp-chat-form')) return;       // skip our own chat form
      var emailField = f.querySelector('input[type="email"], input[name*="email" i]');
      if (!emailField) return;                                 // only forms that capture an email
      if (f.getAttribute('data-pp-bound')) return;
      f.setAttribute('data-pp-bound', '1');
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        var data = collect(f);
        if (!data.email) { f.submit(); return; }
        var btn = f.querySelector('button[type="submit"],input[type="submit"],button');
        if (btn) btn.disabled = true;
        fetch(api('/api/site-lead'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug: cfg.slug, name: data.name, email: data.email,
            phone: data.phone, message: data.message
          })
        })
          .then(function (r) { return r.ok; })
          .then(function (ok) {
            if (btn) btn.disabled = false;
            if (ok) { f.reset(); toast('Thanks! We just emailed you a confirmation.'); }
            else { f.submit(); }
          })
          .catch(function () { if (btn) btn.disabled = false; f.submit(); });
      });
    });
  }
  function collect(form) {
    function val(sel) { var n = form.querySelector(sel); return n ? (n.value || '').trim() : ''; }
    return {
      name: val('input[name*="name" i]'),
      email: val('input[type="email"], input[name*="email" i]'),
      phone: val('input[type="tel"], input[name*="phone" i]'),
      message: val('textarea, input[name*="message" i]')
    };
  }

  // ── Boot ────────────────────────────────────────────────────────────────
  function boot(cfg) {
    if (!cfg) return;
    var F = cfg.features || {};
    if (!F.booking && !F.aiChat && !F.leadAutoReply) return;   // nothing enabled
    injectStyles();
    var stack = el('div', { class: 'pp-fab-stack' });
    document.body.appendChild(stack);
    try { if (F.booking) initBooking(cfg, stack); } catch (e) { console.warn('[pp-automation] booking:', e); }
    // Skip chat entirely when the Step 5 toggle says no. Legacy sites with
    // no chatbot block fall through (treated as enabled) for backward compat.
    var chatOff = cfg.chatbot && cfg.chatbot.enabled === false;
    try { if (F.aiChat && !chatOff) initChat(cfg, stack); } catch (e) { console.warn('[pp-automation] chat:', e); }
    try { if (F.leadAutoReply) initLeadAutoReply(cfg); } catch (e) { console.warn('[pp-automation] lead:', e); }
    if (!stack.children.length) stack.remove();
  }

  function start() { resolveConfig(boot); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
