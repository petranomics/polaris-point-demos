// Pete's Termite & Pest Control - Site Scripts

(function() {
    'use strict';

    // Mobile Navigation Toggle
    var mobileToggle = document.getElementById('mobileToggle');
    var mainNav = document.getElementById('mainNav');

    if (mobileToggle && mainNav) {
        mobileToggle.addEventListener('click', function() {
            mainNav.classList.toggle('active');
            this.classList.toggle('active');
        });

        // Close menu when a nav link is clicked
        mainNav.querySelectorAll('a').forEach(function(link) {
            link.addEventListener('click', function() {
                mainNav.classList.remove('active');
                mobileToggle.classList.remove('active');
            });
        });
    }

    // Sticky header shadow on scroll
    var header = document.getElementById('header');
    if (header) {
        window.addEventListener('scroll', function() {
            if (window.scrollY > 50) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        });
    }

    // Contact Form Handling
    var contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();

            var formData = new FormData(this);
            var data = {};
            formData.forEach(function(value, key) {
                data[key] = value;
            });

            // Basic validation
            if (!data.firstName || !data.lastName || !data.phone || !data.email) {
                showFormMessage('Please fill in all required fields.', 'error');
                return;
            }

            // Email validation
            var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(data.email)) {
                showFormMessage('Please enter a valid email address.', 'error');
                return;
            }

            // Simulate form submission
            var submitBtn = contactForm.querySelector('button[type="submit"]');
            var originalText = submitBtn.textContent;
            submitBtn.textContent = 'Sending...';
            submitBtn.disabled = true;

            setTimeout(function() {
                showFormMessage('Thank you! We\'ve received your request and will contact you within 1 business hour.', 'success');
                contactForm.reset();
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }, 1500);
        });
    }

    function showFormMessage(message, type) {
        // Remove existing message
        var existing = contactForm.querySelector('.form-message');
        if (existing) existing.remove();

        var msgDiv = document.createElement('div');
        msgDiv.className = 'form-message form-message-' + type;
        msgDiv.textContent = message;
        msgDiv.style.cssText = 'padding: 14px 18px; border-radius: 10px; margin-bottom: 16px; font-size: 0.9rem; font-weight: 500;';

        if (type === 'success') {
            msgDiv.style.background = '#e8f5e9';
            msgDiv.style.color = '#1B4332';
            msgDiv.style.border = '1px solid #a5d6a7';
        } else {
            msgDiv.style.background = '#fbe9e7';
            msgDiv.style.color = '#bf360c';
            msgDiv.style.border = '1px solid #ffab91';
        }

        contactForm.insertBefore(msgDiv, contactForm.firstChild);

        // Auto-remove success message after 8 seconds
        if (type === 'success') {
            setTimeout(function() {
                if (msgDiv.parentNode) {
                    msgDiv.style.transition = 'opacity 0.3s';
                    msgDiv.style.opacity = '0';
                    setTimeout(function() { msgDiv.remove(); }, 300);
                }
            }, 8000);
        }
    }

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
        anchor.addEventListener('click', function(e) {
            var targetId = this.getAttribute('href');
            if (targetId === '#') return;
            var target = document.querySelector(targetId);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    // Scroll-triggered animations
    var observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -40px 0px'
    };

    var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Animate elements on scroll
    document.querySelectorAll('.service-card, .why-card, .review-card, .step, .about-inner, .contact-inner, .photo-break img').forEach(function(el) {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });

    // Phone number formatting for input
    var phoneInput = document.getElementById('phone');
    if (phoneInput) {
        phoneInput.addEventListener('input', function() {
            var value = this.value.replace(/\D/g, '');
            if (value.length >= 10) {
                this.value = '(' + value.substring(0, 3) + ') ' + value.substring(3, 6) + '-' + value.substring(6, 10);
            } else if (value.length >= 6) {
                this.value = '(' + value.substring(0, 3) + ') ' + value.substring(3, 6) + '-' + value.substring(6);
            } else if (value.length >= 3) {
                this.value = '(' + value.substring(0, 3) + ') ' + value.substring(3);
            }
        });
    }
})();
