// LSPD-HEAT Scroll Reveal System
// Adds smooth entrance animations to dynamically created UI elements

document.addEventListener('DOMContentLoaded', function () {
  // Target selector groups for reveal animations
  var revealSelectors = [
    '#main-content',
    '.console-card',
    '.module-card',
    '.hero-panel',
    '.hero-badge-panel',
    '.dashboard-hero',
    '[data-reveal]'
  ];

  function initScrollReveals() {
    var nodes = [];
    revealSelectors.forEach(function (selector) {
      var elements = document.querySelectorAll(selector);
      nodes = nodes.concat(Array.from(elements));
    });

    nodes.forEach(function (node, index) {
      if (node.classList.contains('scroll-reveal')) return;
      node.classList.add('scroll-reveal');
      node.style.setProperty('--reveal-delay', String(Math.min(index * 60, 480)) + 'ms');
    });

    if (window.IntersectionObserver) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.16, rootMargin: '-80px 0px' });

      nodes.forEach(function (node) {
        observer.observe(node);
      });
    } else {
      nodes.forEach(function (node) {
        node.classList.add('is-visible');
      });
    }
  }

  // Initial load
  initScrollReveals();

  // Reinitialize on dynamic content updates (for tables, lists, etc.)
  var originalSetTimeout = window.setTimeout;
  var checkInterval = setInterval(function () {
    var hiddenReveals = document.querySelectorAll('[data-reveal]:not(.scroll-reveal)');
    if (hiddenReveals.length > 0) {
      initScrollReveals();
    }
  }, 800);

  // Cleanup on page unload
  window.addEventListener('unload', function () {
    clearInterval(checkInterval);
  });
});
