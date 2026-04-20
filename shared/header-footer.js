// Polaris Point — Shared Header/Footer Injector
// Opt-in: only runs if <div id="pp-header"></div> or <div id="pp-footer"></div> exist.
// Builds nav, logo, footer from SITE_CONFIG. Single source of truth for multi-page sites.
// For single-page demos, this file is never loaded — no impact.
(function() {
  'use strict';
  var C = window.SITE_CONFIG;
  if (!C) return;

  var phone = C.phone || '';
  var phoneTelHref = C.phoneTelHref || '';
  var name = C.businessNameShort || C.businessName || '';
  var email = C.email || '';
  var emailHref = C.emailHref || '';
  var address = C.address || '';
  var hours = C.hours || '';
  var basePath = window.PP_BASE_PATH || '';

  // ── NAV LINKS ──
  // Default nav for single-pagers. Override with C.navLinks for multi-page.
  // Format: [{ text: "Services", href: "/services" }, ...]
  var navLinks = C.navLinks || [
    { text: 'Services', href: basePath + '/#services' },
    { text: 'About', href: basePath + '/#about' },
    { text: 'Reviews', href: basePath + '/#reviews' },
    { text: 'Contact', href: basePath + '/#contact' }
  ];

  // ── HEADER ──
  var headerSlot = document.getElementById('pp-header');
  if (headerSlot) {
    var topbar = '';
    if (C.topbarText) {
      topbar = '<div class="topbar"><div class="container topbar-wrap">'
        + '<span>' + esc(C.topbarText) + '</span>'
        + (phone ? '<a href="' + esc(phoneTelHref) + '">' + esc(phone) + '</a>' : '')
        + '</div></div>';
    }

    var navHtml = navLinks.map(function(l) {
      var cls = l.cta ? ' class="nav-cta"' : '';
      return '<a href="' + esc(l.href) + '"' + cls + '>' + esc(l.text) + '</a>';
    }).join('');

    var logoHtml = '';
    if (C.theme && C.theme.logoUrl) {
      logoHtml = '<img src="' + esc(C.theme.logoUrl) + '" alt="' + esc(name) + '" style="height:36px;width:auto;">';
    } else {
      logoHtml = '<span class="logo-icon">'
        + '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">'
        + '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>'
        + '</svg></span>';
    }

    headerSlot.innerHTML = topbar
      + '<header class="site-header" id="header">'
      + '<div class="container nav">'
      + '<a href="' + (basePath || '/') + '" class="logo">' + logoHtml + ' <span data-cfg="businessNameShort">' + esc(name) + '</span></a>'
      + '<nav class="nav-links" aria-label="Main navigation">' + navHtml + '</nav>'
      + '</div></header>';
  }

  // ── FOOTER ──
  var footerSlot = document.getElementById('pp-footer');
  if (footerSlot) {
    var footerServices = '';
    if (C.footerServices && C.footerServices.length) {
      footerServices = '<div><h4>Services</h4>'
        + C.footerServices.map(function(s) {
          return '<a href="' + basePath + '/#services">' + esc(s) + '</a>';
        }).join('')
        + '</div>';
    }

    var legalHtml = C.footerLegal || ('&copy; ' + new Date().getFullYear() + ' ' + esc(C.businessName || '') + '. All rights reserved.');

    footerSlot.innerHTML = '<footer><div class="container">'
      + '<div class="footer-grid">'
      + '<div>'
      + '<h4 data-cfg="businessName">' + esc(C.businessName || '') + '</h4>'
      + '<p style="font-size:.88rem;margin:0;" data-cfg="footerDescription">' + esc(C.footerDescription || '') + '</p>'
      + '</div>'
      + footerServices
      + '<div>'
      + '<h4>Contact</h4>'
      + (phone ? '<a href="' + esc(phoneTelHref) + '">' + esc(phone) + '</a>' : '')
      + (email ? '<a href="' + esc(emailHref) + '">' + esc(email) + '</a>' : '')
      + (address ? '<span style="font-size:.88rem;">' + esc(address) + '</span>' : '')
      + '</div>'
      + '</div>'
      + '<div class="footer-bottom"><span>' + legalHtml + '</span></div>'
      + '</div></footer>';
  }

  function esc(s) {
    if (!s) return '';
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }
})();
