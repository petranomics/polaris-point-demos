// Polaris Point — Shared Feature Library
// Reads window.SITE_CONFIG (set by config.js) and initializes features
// based on config.features flags. Each feature is self-contained.
(function() {
  'use strict';
  var C = window.SITE_CONFIG;
  if (!C) return;
  var F = C.features || {};

  // ─── SVG Icon Templates ──────────────────────────────────────────────
  var ICONS = {
    hamburger: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',
    close: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    phone: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24 11.72 11.72 0 003.66.58 1 1 0 011 1v3.61a1 1 0 01-1 1A17 17 0 013 4.08a1 1 0 011-1h3.61a1 1 0 011 1 11.72 11.72 0 00.58 3.66 1 1 0 01-.24 1.01l-2.33 2.04z"/></svg>',
    sms: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M20 2H4a2 2 0 00-2 2v18l4-4h14a2 2 0 002-2V4a2 2 0 00-2-2zm0 14H5.17L4 17.17V4h16v12zM7 9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z"/></svg>',
    email: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M20 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>',
    whatsapp: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M17.47 14.38c-.29-.15-1.71-.84-1.98-.94s-.46-.15-.65.15-.75.94-.92 1.13-.34.22-.63.07a7.9 7.9 0 01-2.33-1.44 8.7 8.7 0 01-1.61-2.01c-.17-.29 0-.44.13-.59.12-.13.29-.34.43-.51s.19-.29.29-.49a.53.53 0 00-.02-.51c-.07-.15-.65-1.57-.89-2.15-.24-.56-.48-.49-.65-.49h-.56a1.07 1.07 0 00-.78.37 3.28 3.28 0 00-1.02 2.44 5.69 5.69 0 001.19 3.02 13.05 13.05 0 005 4.42 11.3 11.3 0 001.67.62 4.02 4.02 0 001.84.12 3.01 3.01 0 001.98-1.39 2.44 2.44 0 00.17-1.39c-.07-.12-.26-.19-.55-.34zM12.05 2A9.94 9.94 0 002.12 12a9.86 9.86 0 001.33 4.96L2 22l5.18-1.36A9.94 9.94 0 0022 12.05 10 10 0 0012.05 2zm5.8 14.12a5.18 5.18 0 01-3.5 1.67A10.05 10.05 0 017 15.27a12.48 12.48 0 01-2.74-3.33 5.72 5.72 0 011.15-7.18 1.88 1.88 0 011.37-.59l.95.02c.32 0 .74-.12 1.15.87s1.3 3.17 1.41 3.4a.84.84 0 01.04.8 3.13 3.13 0 01-.47.77c-.23.27-.48.6-.69.8-.23.23-.47.48-.2.94a13.9 13.9 0 002.54 3.17 12.66 12.66 0 003.66 2.27c.46.23.73.19 1-.12s1.15-1.34 1.46-1.8.62-.39.95-.24 2.79 1.32 3.07 1.56.47.34.54.53a2.35 2.35 0 01-.19 1.37z"/></svg>',
    arrowLeft: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
    arrowRight: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>',
    star: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
    chevronDown: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>'
  };

  // ─── Helpers ──────────────────────────────────────────────────────────
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function(k) {
      if (k === 'className') node.className = attrs[k];
      else if (k === 'textContent') node.textContent = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    if (children) children.forEach(function(c) {
      if (typeof c === 'string') node.appendChild(document.createTextNode(c));
      else if (c) node.appendChild(c);
    });
    return node;
  }

  function setHTML(node, html) { node.innerHTML = html; }

  function debounce(fn, ms) {
    var t;
    return function() {
      var ctx = this, args = arguments;
      clearTimeout(t);
      t = setTimeout(function() { fn.apply(ctx, args); }, ms);
    };
  }

  function getHeader() {
    return document.querySelector('.site-header') || document.querySelector('header');
  }

  function getHeaderHeight() {
    var h = getHeader();
    return h ? h.offsetHeight : 0;
  }

  // Focus trap utility for modals
  function trapFocus(container) {
    var focusable = container.querySelectorAll(
      'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])'
    );
    var first = focusable[0], last = focusable[focusable.length - 1];
    container.addEventListener('keydown', function(e) {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  // ─── 1. Mobile Nav ───────────────────────────────────────────────────
  function initMobileNav() {
    var header = getHeader();
    if (!header) return;
    var nav = header.querySelector('.nav') || header.querySelector('.header-inner') || header;
    var links = nav.querySelector('.nav-links') || nav.querySelector('.main-nav') || nav.querySelector('nav');
    if (!links) return;

    // Hamburger button — append at end of nav so it sits on the right
    var burger = el('button', {
      className: 'mobile-nav-toggle',
      'aria-label': 'Open navigation menu',
      'aria-expanded': 'false'
    });
    setHTML(burger, ICONS.hamburger);
    nav.appendChild(burger);

    // Overlay — flat structure, links directly inside overlay (no extra panel wrapper)
    var overlay = el('div', { className: 'mobile-nav-overlay', 'aria-hidden': 'true' });
    var closeBtn = el('button', {
      className: 'mobile-nav-close',
      'aria-label': 'Close navigation menu'
    });
    setHTML(closeBtn, ICONS.close);
    overlay.appendChild(closeBtn);

    // Clone each nav link into overlay
    links.querySelectorAll('a').forEach(function(a) {
      var link = el('a', { href: a.getAttribute('href') }, [a.textContent]);
      overlay.appendChild(link);
    });
    document.body.appendChild(overlay);

    var isOpen = false;

    function open() {
      isOpen = true;
      overlay.classList.add('active');
      overlay.setAttribute('aria-hidden', 'false');
      burger.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
      closeBtn.focus();
      trapFocus(overlay);
    }

    function close() {
      isOpen = false;
      overlay.classList.remove('active');
      overlay.setAttribute('aria-hidden', 'true');
      burger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }

    burger.addEventListener('click', function() { isOpen ? close() : open(); });
    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });
    overlay.querySelectorAll('a').forEach(function(a) { a.addEventListener('click', close); });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && isOpen) close();
    });
  }

  // ─── 2. Active Nav Highlighting ──────────────────────────────────────
  function initActiveNav() {
    var sections = document.querySelectorAll('section[id]');
    if (!sections.length) return;
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          var id = entry.target.getAttribute('id');
          document.querySelectorAll('.nav-links a, .main-nav a, .mobile-nav-overlay a').forEach(function(a) {
            a.classList.toggle('active', a.getAttribute('href') === '#' + id);
          });
        }
      });
    }, { threshold: 0.3 });
    sections.forEach(function(s) { observer.observe(s); });
  }

  // ─── 3. Sticky Header Shadow ─────────────────────────────────────────
  function initStickyHeader() {
    var header = getHeader();
    if (!header) return;
    var onScroll = debounce(function() {
      requestAnimationFrame(function() {
        header.classList.toggle('scrolled', window.scrollY > 50);
      });
    }, 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ─── 4. Smooth Scroll ────────────────────────────────────────────────
  function initSmoothScroll() {
    document.addEventListener('click', function(e) {
      var link = e.target.closest('a[href^="#"]');
      if (!link) return;
      var hash = link.getAttribute('href');
      if (hash.length < 2) return;
      var target = document.querySelector(hash);
      if (!target) return;
      e.preventDefault();
      var offset = target.getBoundingClientRect().top + window.scrollY - getHeaderHeight();
      window.scrollTo({ top: offset, behavior: 'smooth' });
      // Update URL without jump
      history.pushState(null, '', hash);
    });
  }

  // ─── 5. Form Handling ────────────────────────────────────────────────
  function initFormHandling() {
    document.querySelectorAll('form').forEach(function(form) {
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        // Remove previous messages
        var prev = form.parentNode.querySelector('.form-message');
        if (prev) prev.remove();

        // Validate required fields
        var valid = true;
        form.querySelectorAll('[required]').forEach(function(input) {
          if (!input.value.trim()) { valid = false; input.classList.add('input-error'); }
          else { input.classList.remove('input-error'); }
        });

        // Validate email
        var emailInputs = form.querySelectorAll('input[type="email"]');
        emailInputs.forEach(function(inp) {
          if (inp.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inp.value)) {
            valid = false;
            inp.classList.add('input-error');
          }
        });

        var msg = el('div', { className: 'form-message', role: 'alert' });
        if (valid) {
          msg.classList.add('form-message--success');
          msg.textContent = 'Thank you! Your message has been sent.';
          form.reset();
          setTimeout(function() { msg.remove(); }, 6000);
        } else {
          msg.classList.add('form-message--error');
          msg.textContent = 'Please fill in all required fields correctly.';
        }
        form.parentNode.insertBefore(msg, form.nextSibling);

        // Track submission if analytics is available
        if (window.gtag) {
          window.gtag('event', 'form_submit', {
            event_category: 'engagement',
            event_label: form.getAttribute('id') || 'form'
          });
        }
      });
    });
  }

  // ─── 6. Phone Formatting ─────────────────────────────────────────────
  function initPhoneFormatting() {
    document.querySelectorAll('input[type="tel"]').forEach(function(input) {
      input.addEventListener('input', function() {
        var digits = input.value.replace(/\D/g, '').substring(0, 10);
        if (digits.length === 0) { input.value = ''; return; }
        if (digits.length <= 3) { input.value = '(' + digits; }
        else if (digits.length <= 6) { input.value = '(' + digits.slice(0, 3) + ') ' + digits.slice(3); }
        else { input.value = '(' + digits.slice(0, 3) + ') ' + digits.slice(3, 6) + '-' + digits.slice(6); }
      });
    });
  }

  // ─── 7. Scroll Reveal ────────────────────────────────────────────────
  function initScrollReveal() {
    var items = document.querySelectorAll('.reveal');
    if (!items.length) return;
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    items.forEach(function(item) { observer.observe(item); });
  }

  // ─── 8. Review Carousel ──────────────────────────────────────────────
  function initReviewCarousel() {
    var reviews = C.reviews;
    if (!reviews || !reviews.length) return;

    var container = document.querySelector('.review-carousel');
    if (!container) {
      // Wrap existing reviews grid if present
      var grid = document.querySelector('.reviews-grid, .reviews .grid');
      if (grid) {
        container = el('div', { className: 'review-carousel' });
        grid.parentNode.insertBefore(container, grid);
        grid.style.display = 'none';
      } else { return; }
    }
    container.innerHTML = '';

    // Build carousel structure
    var track = el('div', { className: 'review-carousel-track' });
    reviews.forEach(function(r) {
      var card = el('div', { className: 'review-carousel-card' });
      var text = el('p', {}, [r.text || r.review || '']);
      var attr = el('cite', {}, ['— ' + (r.name || r.author || 'Customer')]);
      card.appendChild(text);
      card.appendChild(attr);
      track.appendChild(card);
    });
    container.appendChild(track);

    // Dot navigation
    var dots = el('div', { className: 'review-carousel-dots' });
    reviews.forEach(function(_, i) {
      var dot = el('button', {
        className: 'review-carousel-dot' + (i === 0 ? ' active' : ''),
        'aria-label': 'Go to review ' + (i + 1)
      });
      dot.addEventListener('click', function() { goTo(i); });
      dots.appendChild(dot);
    });
    container.appendChild(dots);

    var current = 0;
    var total = reviews.length;
    var autoTimer;

    function goTo(idx) {
      current = ((idx % total) + total) % total;
      track.style.transform = 'translateX(-' + (current * 100) + '%)';
      dots.querySelectorAll('.review-carousel-dot').forEach(function(d, i) {
        d.classList.toggle('active', i === current);
      });
    }

    function startAuto() {
      autoTimer = setInterval(function() { goTo(current + 1); }, 5000);
    }
    function stopAuto() { clearInterval(autoTimer); }

    startAuto();
    container.addEventListener('mouseenter', stopAuto);
    container.addEventListener('mouseleave', startAuto);

    // Touch swipe support
    var touchStartX = 0;
    container.addEventListener('touchstart', function(e) {
      touchStartX = e.changedTouches[0].clientX;
      stopAuto();
    }, { passive: true });
    container.addEventListener('touchend', function(e) {
      var dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 50) goTo(current + (dx < 0 ? 1 : -1));
      startAuto();
    }, { passive: true });
  }

  // ─── 9. Google Reviews Badge ─────────────────────────────────────────
  function initGoogleReviewsBadge() {
    if (!C.googleReviewsRating || !C.googleReviewsCount) return;
    var wrapper = C.googleReviewsUrl
      ? el('a', { className: 'google-badge', href: C.googleReviewsUrl, target: '_blank', rel: 'noopener noreferrer', 'aria-label': 'Google Reviews' })
      : el('div', { className: 'google-badge' });
    var starSpan = el('span', { className: 'star' });
    setHTML(starSpan, ICONS.star);
    var text = el('span', {}, [C.googleReviewsRating + ' (' + C.googleReviewsCount + ' reviews)']);
    wrapper.appendChild(starSpan);
    wrapper.appendChild(text);
    var target = document.querySelector('.trust-strip') || document.querySelector('.hero');
    if (target) target.appendChild(wrapper);
  }

  // ─── 10. Floating Action Buttons ─────────────────────────────────────
  function initFloatingButtons() {
    var fab = el('div', { className: 'fab-container', 'aria-label': 'Contact actions' });
    var buttons = [];

    if (C.phoneTelHref) {
      buttons.push({ href: C.phoneTelHref, icon: ICONS.phone, label: 'Call us' });
    }
    if (C.smsNumber) {
      buttons.push({ href: 'sms:' + C.smsNumber, icon: ICONS.sms, label: 'Text us' });
    }
    if (C.emailHref) {
      buttons.push({ href: C.emailHref, icon: ICONS.email, label: 'Email us' });
    }
    if (C.whatsappNumber) {
      buttons.push({ href: 'https://wa.me/' + C.whatsappNumber, icon: ICONS.whatsapp, label: 'WhatsApp us' });
    }

    if (!buttons.length) return;

    buttons.forEach(function(b, i) {
      var a = el('a', { className: 'fab-btn', href: b.href, 'aria-label': b.label, target: b.href.startsWith('http') ? '_blank' : undefined });
      if (b.href.startsWith('http')) a.setAttribute('rel', 'noopener noreferrer');
      setHTML(a, b.icon);
      a.style.transitionDelay = (i * 0.08) + 's';
      fab.appendChild(a);
    });

    document.body.appendChild(fab);

    // Stagger entrance — add .visible to each child button with delay
    requestAnimationFrame(function() {
      fab.querySelectorAll('.fab-btn').forEach(function(btn, i) {
        setTimeout(function() { btn.classList.add('visible'); }, 300 + (i * 80));
      });
    });

    // Hide near footer
    var footer = document.querySelector('footer');
    if (footer) {
      var obs = new IntersectionObserver(function(entries) {
        fab.classList.toggle('hidden', entries[0].isIntersecting);
      }, { threshold: 0.1 });
      obs.observe(footer);
    }
  }

  // ─── 11. Sticky Bottom CTA ───────────────────────────────────────────
  function initStickyBottomCta() {
    var bar = el('div', { className: 'sticky-cta-bar' });
    if (C.phoneTelHref) {
      bar.appendChild(el('a', { className: 'cta-secondary', href: C.phoneTelHref, 'aria-label': 'Call now' }, ['Call Now']));
    }
    bar.appendChild(el('a', { className: 'cta-primary', href: '#contact', 'aria-label': 'Get a free quote' }, [C.ctaText || 'Free Quote']));
    document.body.appendChild(bar);

    // Hide near footer
    var footer = document.querySelector('footer');
    if (footer) {
      var obs = new IntersectionObserver(function(entries) {
        bar.classList.toggle('hidden', entries[0].isIntersecting);
      }, { threshold: 0.1 });
      obs.observe(footer);
    }
  }

  // ─── 12. Exit Intent Popup ───────────────────────────────────────────
  function initExitIntent() {
    var cfg = C.exitIntent;
    if (!cfg || sessionStorage.getItem('pp_exit_shown')) return;

    var overlay = el('div', { className: 'exit-popup-overlay', role: 'dialog', 'aria-modal': 'true' });
    var popup = el('div', { className: 'exit-popup' });
    var closeBtn = el('button', { className: 'popup-close', 'aria-label': 'Close popup' });
    setHTML(closeBtn, ICONS.close);
    var h2 = el('h3', {}, [cfg.headline || 'Wait!']);
    var p = el('p', {}, [cfg.text || '']);
    var cta = el('a', {
      className: 'popup-cta',
      href: cfg.ctaUrl || '#contact'
    }, [cfg.cta || cfg.ctaText || 'Get Your Free Quote']);
    var dismiss = el('button', { className: 'popup-close' }, ['No thanks']);

    popup.appendChild(closeBtn);
    popup.appendChild(h2);
    popup.appendChild(p);
    popup.appendChild(cta);
    popup.appendChild(dismiss);
    overlay.appendChild(popup);

    function show() {
      document.body.appendChild(overlay);
      requestAnimationFrame(function() { overlay.classList.add('active'); });
      sessionStorage.setItem('pp_exit_shown', '1');
      trapFocus(popup);
      closeBtn.focus();
    }

    function hide() {
      overlay.classList.remove('active');
      setTimeout(function() { overlay.remove(); }, 300);
    }

    closeBtn.addEventListener('click', hide);
    dismiss.addEventListener('click', hide);
    cta.addEventListener('click', hide);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) hide(); });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && overlay.parentNode) hide();
    });

    // Desktop: mouse leaves top of viewport
    document.addEventListener('mouseout', function(e) {
      if (e.clientY < 5 && !sessionStorage.getItem('pp_exit_shown')) show();
    });

    // Mobile: rapid scroll up
    var lastY = window.scrollY;
    window.addEventListener('scroll', debounce(function() {
      var dy = window.scrollY - lastY;
      if (dy < -200 && window.scrollY > 300 && !sessionStorage.getItem('pp_exit_shown')) show();
      lastY = window.scrollY;
    }, 100), { passive: true });
  }

  // ─── 13. Urgency Banner ──────────────────────────────────────────────
  function initUrgencyBanner() {
    var cfg = C.urgencyBanner;
    if (!cfg) return;
    if (cfg.endDate && new Date(cfg.endDate) < new Date()) return;
    if (sessionStorage.getItem('pp_banner_dismissed')) return;

    var banner = el('div', { className: 'urgency-banner', role: 'alert' });
    var text = el('span', { className: 'urgency-text' }, [cfg.text || '']);
    var dismiss = el('button', { className: 'urgency-close', 'aria-label': 'Dismiss banner' });
    setHTML(dismiss, ICONS.close);
    banner.appendChild(text);

    // Optional countdown
    if (cfg.endDate) {
      var countdown = el('span', { className: 'urgency-countdown' });
      banner.appendChild(countdown);
      var endTime = new Date(cfg.endDate).getTime();
      (function tick() {
        var diff = endTime - Date.now();
        if (diff <= 0) { banner.remove(); return; }
        var d = Math.floor(diff / 86400000);
        var h = Math.floor((diff % 86400000) / 3600000);
        var m = Math.floor((diff % 3600000) / 60000);
        countdown.textContent = (d > 0 ? d + 'd ' : '') + h + 'h ' + m + 'm remaining';
        setTimeout(tick, 60000);
      })();
    }

    banner.appendChild(dismiss);
    dismiss.addEventListener('click', function() {
      banner.remove();
      sessionStorage.setItem('pp_banner_dismissed', '1');
    });

    var slot = document.getElementById('urgencyBannerSlot');
    if (slot) {
      slot.appendChild(banner);
    } else {
      var header = getHeader();
      if (header && header.nextSibling) {
        header.parentNode.insertBefore(banner, header.nextSibling);
      } else {
        document.body.insertBefore(banner, document.body.firstChild);
      }
    }
  }

  // ─── 14. FAQ Accordion ───────────────────────────────────────────────
  function initFaqAccordion() {
    var faqs = C.faqs;
    if (!faqs || !faqs.length) return;

    var section = document.querySelector('.faq-section');
    if (!section) {
      section = el('section', { className: 'faq-section', id: 'faq' });
      var heading = el('h2', { className: 'section-title' }, ['Frequently Asked Questions']);
      section.appendChild(heading);
      var contact = document.querySelector('#contact, .contact-section');
      if (contact) contact.parentNode.insertBefore(section, contact);
      else document.querySelector('main, body').appendChild(section);
    }

    var container = document.getElementById('faqContainer') || section;
    faqs.forEach(function(faq) {
      var details = el('details', {});
      var summary = el('summary', {}, [faq.question || faq.q || '']);
      var answer = el('div', { className: 'faq-body' }, [faq.answer || faq.a || '']);
      details.appendChild(summary);
      details.appendChild(answer);
      container.appendChild(details);
    });
  }

  // ─── 15. Service Area Map ────────────────────────────────────────────
  function initServiceAreaMap() {
    if (!C.googleMapsEmbed) return;
    var section = document.getElementById('mapSlot') || document.querySelector('.service-area, .service-areas, #service-area, #service-areas');
    if (!section) return;
    var iframe = el('iframe', {
      className: 'service-map',
      src: C.googleMapsEmbed,
      'aria-label': 'Service area map',
      loading: 'lazy',
      width: '100%',
      height: '400',
      frameborder: '0',
      allowfullscreen: ''
    });
    section.appendChild(iframe);
  }

  // ─── 16. Lightbox ────────────────────────────────────────────────────
  function initLightbox() {
    var images = document.querySelectorAll('.lightbox-trigger, .gallery img');
    if (!images.length) return;
    var srcs = [];
    images.forEach(function(img) { srcs.push(img.src || img.getAttribute('data-src')); });

    var overlay = el('div', { className: 'lightbox-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Image lightbox' });
    var closeBtn = el('button', { className: 'lightbox-close', 'aria-label': 'Close lightbox' });
    setHTML(closeBtn, ICONS.close);
    var prevBtn = el('button', { className: 'lightbox-prev', 'aria-label': 'Previous image' });
    setHTML(prevBtn, ICONS.arrowLeft);
    var nextBtn = el('button', { className: 'lightbox-next', 'aria-label': 'Next image' });
    setHTML(nextBtn, ICONS.arrowRight);
    var img = el('img', { className: 'lightbox-img', alt: 'Enlarged photo' });
    overlay.appendChild(closeBtn);
    overlay.appendChild(prevBtn);
    overlay.appendChild(img);
    overlay.appendChild(nextBtn);

    var current = 0;

    function show(idx) {
      current = idx;
      img.src = srcs[current];
      document.body.appendChild(overlay);
      requestAnimationFrame(function() { overlay.classList.add('active'); });
      document.body.style.overflow = 'hidden';
      trapFocus(overlay);
      closeBtn.focus();
    }

    function hide() {
      overlay.classList.remove('active');
      document.body.style.overflow = '';
      setTimeout(function() { if (overlay.parentNode) overlay.remove(); }, 300);
    }

    function nav(dir) {
      current = ((current + dir) % srcs.length + srcs.length) % srcs.length;
      img.src = srcs[current];
    }

    images.forEach(function(trigger, i) {
      trigger.style.cursor = 'pointer';
      trigger.addEventListener('click', function() { show(i); });
    });

    closeBtn.addEventListener('click', hide);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) hide(); });
    prevBtn.addEventListener('click', function() { nav(-1); });
    nextBtn.addEventListener('click', function() { nav(1); });
    document.addEventListener('keydown', function(e) {
      if (!overlay.parentNode) return;
      if (e.key === 'Escape') hide();
      if (e.key === 'ArrowLeft') nav(-1);
      if (e.key === 'ArrowRight') nav(1);
    });
  }

  // ─── 17. Cookie Consent ──────────────────────────────────────────────
  function initCookieConsent() {
    var cfg = C.cookieConsent;
    if (!cfg) return;
    var stored = localStorage.getItem('pp_cookie_consent');
    if (stored) {
      if (stored === 'accepted') initAnalyticsScripts();
      return;
    }

    var banner = el('div', { className: 'cookie-banner', role: 'alert' });
    var text = el('p', {}, [cfg.text || 'We use cookies to improve your experience.']);
    var actions = el('div', { className: 'cookie-actions' });
    var accept = el('button', { className: 'accept-btn' }, ['Accept']);
    var decline = el('button', { className: 'decline-btn' }, ['Decline']);
    actions.appendChild(accept);
    actions.appendChild(decline);
    banner.appendChild(text);
    banner.appendChild(actions);
    document.body.appendChild(banner);

    // Trigger entrance animation
    requestAnimationFrame(function() { banner.classList.add('visible'); });

    accept.addEventListener('click', function() {
      localStorage.setItem('pp_cookie_consent', 'accepted');
      banner.remove();
      initAnalyticsScripts();
    });
    decline.addEventListener('click', function() {
      localStorage.setItem('pp_cookie_consent', 'declined');
      banner.remove();
    });
  }

  // ─── 18. Analytics ───────────────────────────────────────────────────
  function initAnalyticsScripts() {
    var cfg = C.analytics;
    if (!cfg) return;

    // GA4
    if (cfg.ga4Id) {
      var gs = document.createElement('script');
      gs.async = true;
      gs.src = 'https://www.googletagmanager.com/gtag/js?id=' + cfg.ga4Id;
      document.head.appendChild(gs);
      var gi = document.createElement('script');
      gi.textContent = 'window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag("js",new Date());gtag("config","' + cfg.ga4Id + '");';
      document.head.appendChild(gi);
    }

    // Meta Pixel
    if (cfg.metaPixelId) {
      var mp = document.createElement('script');
      mp.textContent = '!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version="2.0";n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,"script","https://connect.facebook.net/en_US/fbevents.js");fbq("init","' + cfg.metaPixelId + '");fbq("track","PageView");';
      document.head.appendChild(mp);
    }

    // Hotjar
    if (cfg.hotjarId) {
      var hj = document.createElement('script');
      hj.textContent = '(function(h,o,t,j,a,r){h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};h._hjSettings={hjid:' + cfg.hotjarId + ',hjsv:6};a=o.getElementsByTagName("head")[0];r=o.createElement("script");r.async=1;r.src=t+h._hjSettings.hjid+j;a.appendChild(r)})(window,document,"https://static.hotjar.com/c/hotjar-",".js?sv=6");';
      document.head.appendChild(hj);
    }

    // Track phone link clicks
    document.querySelectorAll('a[href^="tel:"]').forEach(function(a) {
      a.addEventListener('click', function() {
        if (window.gtag) window.gtag('event', 'phone_click', { event_category: 'contact' });
        if (window.fbq) window.fbq('track', 'Contact');
      });
    });
  }

  function initAnalytics() {
    // If no cookie consent feature, init immediately; otherwise wait for consent
    if (!F.cookieConsent || !C.cookieConsent) {
      initAnalyticsScripts();
    }
    // If consent feature is active, initAnalyticsScripts is called by consent handler
  }

  // ─── 19. Team Bio Modals ─────────────────────────────────────────────
  function initTeamModals() {
    var triggers = document.querySelectorAll('[data-team-modal]');
    if (!triggers.length || !C.team || !C.team.length) return;

    var overlay = el('div', { className: 'team-modal-overlay', role: 'dialog', 'aria-modal': 'true' });
    var modal = el('div', { className: 'team-modal' });
    var closeBtn = el('button', { className: 'team-modal-close', 'aria-label': 'Close bio' });
    setHTML(closeBtn, ICONS.close);
    var content = el('div', { className: 'team-modal-content' });
    modal.appendChild(closeBtn);
    modal.appendChild(content);
    overlay.appendChild(modal);

    function show(idx) {
      var member = C.team[idx];
      if (!member) return;
      content.innerHTML = '';
      if (member.image) {
        var img = el('img', { src: member.image, alt: member.name || '', className: 'team-modal-img' });
        content.appendChild(img);
      }
      content.appendChild(el('h3', {}, [member.name || '']));
      if (member.role) content.appendChild(el('p', { className: 'team-modal-role' }, [member.role]));
      content.appendChild(el('p', { className: 'team-modal-bio' }, [member.bio || '']));
      document.body.appendChild(overlay);
      requestAnimationFrame(function() { overlay.classList.add('active'); });
      document.body.style.overflow = 'hidden';
      trapFocus(modal);
      closeBtn.focus();
    }

    function hide() {
      overlay.classList.remove('active');
      document.body.style.overflow = '';
      setTimeout(function() { if (overlay.parentNode) overlay.remove(); }, 300);
    }

    triggers.forEach(function(t) {
      t.addEventListener('click', function() {
        var idx = parseInt(t.getAttribute('data-team-modal'), 10);
        show(idx);
      });
    });

    closeBtn.addEventListener('click', hide);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) hide(); });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && overlay.parentNode) hide();
    });
  }

  // ─── 20. Blog Preview ────────────────────────────────────────────────
  function initBlogPreview() {
    var posts = C.blogPosts;
    if (!posts || !posts.length) return;

    var section = document.querySelector('.blog-section, #blog');
    if (!section) {
      section = el('section', { className: 'blog-section', id: 'blog' });
      var heading = el('h2', { className: 'section-title' }, ['Latest Updates']);
      section.appendChild(heading);
      var footer = document.querySelector('footer');
      if (footer) footer.parentNode.insertBefore(section, footer);
      else document.querySelector('main, body').appendChild(section);
    }

    var container = document.getElementById('blogContainer');
    var grid = container || el('div', { className: 'blog-grid' });
    if (!container) grid.className = 'blog-grid';
    posts.slice(0, 3).forEach(function(post) {
      var card = el('div', { className: 'blog-card' });
      if (post.image) {
        var img = el('img', { src: post.image, alt: post.title || '', loading: 'lazy' });
        card.appendChild(img);
      }
      var body = el('div', { className: 'blog-card-body' });
      body.appendChild(el('h3', {}, [post.title || '']));
      body.appendChild(el('p', {}, [post.excerpt || '']));
      if (post.url) {
        body.appendChild(el('a', { href: post.url, className: 'read-more' }, ['Read More \u2192']));
      }
      card.appendChild(body);
      grid.appendChild(card);
    });
    if (!container) section.appendChild(grid);
  }

  // ─── Initialize Features ─────────────────────────────────────────────
  function initAll() {
    try { if (F.mobileNav) initMobileNav(); } catch(e) { console.warn('MobileNav:', e); }
    try { if (F.activeNavHighlight) initActiveNav(); } catch(e) { console.warn('ActiveNav:', e); }
    try { if (F.stickyHeader) initStickyHeader(); } catch(e) { console.warn('StickyHeader:', e); }
    try { if (F.smoothScroll) initSmoothScroll(); } catch(e) { console.warn('SmoothScroll:', e); }
    try { if (F.formHandling) { initFormHandling(); initPhoneFormatting(); } } catch(e) { console.warn('FormHandling:', e); }
    try { if (F.scrollReveal) initScrollReveal(); } catch(e) { console.warn('ScrollReveal:', e); }
    try { if (F.reviewCarousel) initReviewCarousel(); } catch(e) { console.warn('ReviewCarousel:', e); }
    try { if (F.googleReviewsBadge) initGoogleReviewsBadge(); } catch(e) { console.warn('GoogleBadge:', e); }
    try { if (F.floatingButtons) initFloatingButtons(); } catch(e) { console.warn('FABs:', e); }
    try { if (F.stickyBottomCta) initStickyBottomCta(); } catch(e) { console.warn('StickyCTA:', e); }
    try { if (F.exitIntent) initExitIntent(); } catch(e) { console.warn('ExitIntent:', e); }
    try { if (F.urgencyBanner) initUrgencyBanner(); } catch(e) { console.warn('UrgencyBanner:', e); }
    try { if (F.faqAccordion) initFaqAccordion(); } catch(e) { console.warn('FAQ:', e); }
    try { if (F.serviceAreaMap) initServiceAreaMap(); } catch(e) { console.warn('Map:', e); }
    try { if (F.lightbox) initLightbox(); } catch(e) { console.warn('Lightbox:', e); }
    try { if (F.cookieConsent) initCookieConsent(); } catch(e) { console.warn('Cookie:', e); }
    try { if (F.analytics) initAnalytics(); } catch(e) { console.warn('Analytics:', e); }
    try { if (F.teamModals) initTeamModals(); } catch(e) { console.warn('TeamModals:', e); }
    try { if (F.blogPreview) initBlogPreview(); } catch(e) { console.warn('Blog:', e); }
  }

  // Run on DOMContentLoaded if doc not ready, otherwise immediately
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

})();
