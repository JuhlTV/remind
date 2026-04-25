document.addEventListener('DOMContentLoaded', function () {
    // Respect user's motion preferences
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
        document.documentElement.classList.add('reduce-motion');
        // Show all elements immediately if motion is reduced
        document.querySelectorAll('.scroll-reveal').forEach(el => el.classList.add('is-visible'));
        return;
    }

    var selectors = [
        '.hero-panel',
        '.command-panel',
        '.info-card',
        '.showcase-card',
        '.section-panel',
        '.callout-panel',
        '.news-panel',
        '.form-panel',
        '.spotlight-panel',
        '.detail-band-card',
        '.org-node',
        '.command-badge',
        '.insignia-card',
        '[data-reveal]' // Support for data-reveal attribute
    ];

    var nodes = Array.from(document.querySelectorAll(selectors.join(',')));
    
    if (nodes.length === 0) {
        console.log('reveal.js: No elements found to animate');
        return;
    }

    nodes.forEach(function (node, index) {
        node.classList.add('scroll-reveal');
        // Stagger animations with a max delay of 560ms
        node.style.setProperty('--reveal-delay', String(Math.min(index * 70, 560)) + 'ms');
    });

    if (!('IntersectionObserver' in window)) {
        console.warn('IntersectionObserver not supported - showing all elements immediately');
        nodes.forEach(function (node) {
            node.classList.add('is-visible');
        });
        return;
    }

    var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (!entry.isIntersecting) {
                return;
            }
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
        });
    }, {
        threshold: 0.16,
        rootMargin: '0px 0px -8% 0px'
    });

    nodes.forEach(function (node) {
        observer.observe(node);
    });

    console.log(`reveal.js: Initialized ${nodes.length} elements for reveal animations`);
});