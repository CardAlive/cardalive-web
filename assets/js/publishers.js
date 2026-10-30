/* CardAlive /publishers/ — the prototypes play in place, and the hand of four fans out.
   Each .vframe shows a still until it is clicked, then swaps itself for the
   player: a local <video>, or YouTube (privacy-enhanced) for [data-yt]. */
(function () {
  'use strict';

  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // The hand of four starts stacked when it is below the fold, and fans out as it scrolls into view
  var hand = document.querySelector('.p-hand');
  if (hand && window.IntersectionObserver && hand.getBoundingClientRect().top > innerHeight) {
    hand.classList.add('is-stacked');
    var io = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      hand.classList.remove('is-stacked');
      io.disconnect();
    }, { threshold: 0.5 });
    io.observe(hand);
  }

  Array.prototype.forEach.call(document.querySelectorAll('.vframe'), function (btn) {
    btn.addEventListener('click', function () {
      var el;
      if (btn.dataset.yt) {
        el = document.createElement('iframe');
        el.src = 'https://www.youtube-nocookie.com/embed/' + btn.dataset.yt + '?autoplay=1&rel=0&playsinline=1';
        el.title = btn.dataset.ytTitle || 'CardAlive video';
        el.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
        el.allowFullscreen = true;
        el.referrerPolicy = 'strict-origin-when-cross-origin';
      } else {
        el = document.createElement('video');
        el.src = btn.dataset.src;
        el.poster = btn.dataset.poster || '';
        el.controls = true; el.playsInline = true; el.autoplay = true;
      }
      el.className = 'vframe vframe--live';
      btn.replaceWith(el);
      if (el.play) { var p = el.play(); if (p && p.catch) p.catch(function () {}); }
      el.focus && el.focus();
    });
  });
})();
