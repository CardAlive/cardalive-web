/* CardAlive — poster type, shared by the home page and /publishers/.
   Each [data-fit] line is sized to fill its parent's width, capped at the share of the
   screen height its value names. It is an inline-block that does not wrap, so measured
   at 100px its width is its widest line; on phones its words stack and the longest
   word sets the size. Recomputed on resize and when the fonts arrive. */
(function () {
  'use strict';

  var els = Array.prototype.slice.call(document.querySelectorAll('[data-fit]'));
  if (!els.length) return;

  function fit() {
    els.forEach(function (el) {
      var box = el.parentElement, cs = getComputedStyle(box);
      el.style.fontSize = '100px';
      var w = el.getBoundingClientRect().width;
      var avail = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      if (!w || !avail) return;
      var cap = innerHeight * parseFloat(el.dataset.fit || '0.24');
      el.style.fontSize = Math.min(100 * avail / w, cap).toFixed(2) + 'px';
    });
  }

  fit();
  var raf = 0;
  window.addEventListener('resize', function () { cancelAnimationFrame(raf); raf = requestAnimationFrame(fit); });
  if (document.fonts) {
    document.fonts.ready.then(fit);
    if (document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', fit);
  }
})();
