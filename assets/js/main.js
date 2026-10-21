/* CardAlive — page behaviour (vanilla, no deps).
   The page is a fixed stage of four scenes. One wheel flick, swipe or key
   press moves one scene; the camera flies there through the city while
   the text dissolves out and back in. Shared state for world.js lives
   in window.CA: the camera keyframe and the corruption level. Everything
   here works without WebGL. The email forms live in forms.js. */
(function () {
  'use strict';

  var S = (window.CA = window.CA || {});
  S.camKey = 'hero'; S.corr = 0.1; S.span = 0; S.veil = false; S.boss = 0; S.withdrawn = false; S.hit = 0;

  var params = new URLSearchParams(location.search);
  var STILL = params.has('still');            // screenshots: no intro, no stagger
  var CAM = params.get('cam');                // screenshots: open on one scene
  // Full motion by default, even when the OS asks for reduced motion. Those visitors get a nav toggle to turn it off, remembered.
  var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  var motionPref = null;
  try { motionPref = localStorage.getItem('ca-motion'); } catch (err) {}
  var reduceMotion = motionPref === 'reduce';
  function applyMotion() {
    S.reduceMotion = reduceMotion;
    document.body.classList.toggle('rm', reduceMotion);
    var b = document.getElementById('motion');
    if (!b) return;
    b.hidden = !motionQuery.matches && !reduceMotion;
    b.setAttribute('aria-pressed', String(!reduceMotion));
    b.querySelector('.motion__label').textContent = reduceMotion ? 'Full motion' : 'Reduce motion';
    b.title = reduceMotion ? 'Turn the camera flights back on.' : 'Turn off the camera flights and drifting effects.';
  }
  applyMotion();
  if (motionQuery.addEventListener) motionQuery.addEventListener('change', applyMotion);
  document.getElementById('motion').addEventListener('click', function () {
    reduceMotion = !reduceMotion;
    motionPref = reduceMotion ? 'reduce' : 'full';
    try { localStorage.setItem('ca-motion', motionPref); } catch (err) {}
    applyMotion();
    teaserSync();
  });
  if (STILL) document.body.classList.add('is-still');

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };

  var yearEl = $('#year'); if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ------------------------------------------------------------
     Split headings into words that rise one by one
     ------------------------------------------------------------ */
  $$('[data-split]').forEach(function (el) {
    var i = 0;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          var frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            var w = document.createElement('span'); w.className = 'w';
            var inner = document.createElement('span'); inner.textContent = part;
            inner.style.setProperty('--i', i++);
            w.appendChild(inner); frag.appendChild(w);
          });
          child.parentNode.replaceChild(frag, child);
        } else if (child.nodeType === 1) {
          walk(child);
        }
      });
    })(el);
  });

  /* ------------------------------------------------------------
     Scenes
     ------------------------------------------------------------ */
  var scenes = $$('.scene');
  var ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
  var index = -1, locked = false;
  var hint = $('#hint');
  if (window.matchMedia('(pointer: coarse)').matches) $('span', hint).textContent = 'Swipe';

  var railEl = $('#rail');
  scenes.forEach(function (sc, i) {
    var li = document.createElement('li');
    li.innerHTML = '<button type="button" data-goto="' + i + '"><span class="rail__t">' + sc.dataset.title + '</span><span class="rail__n">' + ROMAN[i] + '</span></button>';
    railEl.appendChild(li);
  });
  var railItems = $$('li', railEl);

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-goto]');
    if (!t) return;
    e.preventDefault();
    go(parseInt(t.dataset.goto, 10));
    // "Join the Waitlist" lands in the lantern's field once the scene has re-formed (not on touch: the keyboard would cover it)
    var field = t.dataset.focus && document.getElementById(t.dataset.focus);
    if (field && !matchMedia('(pointer: coarse)').matches) {
      setTimeout(function () { field.focus({ preventScroll: true }); }, reduceMotion ? 400 : 1300);
    }
  });

  function go(i, opts) {
    opts = opts || {};
    i = clamp(i, 0, scenes.length - 1);
    if (i === index && !opts.force) return;
    var dir = i > index ? 1 : -1;
    var from = scenes[index], to = scenes[i];
    if (from && from !== to) {
      from.classList.remove('is-active');
      from.classList.add(dir > 0 ? 'is-out-up' : 'is-out-down');
      from.setAttribute('aria-hidden', 'true');
      from.inert = true;
      (function (el) { setTimeout(function () { el.classList.remove('is-out-up', 'is-out-down'); }, 900); })(from);
    }
    index = i;
    to.classList.remove('is-out-up', 'is-out-down');
    to.dataset.dir = dir > 0 ? 'up' : 'down';
    to.classList.add('is-active');
    to.removeAttribute('aria-hidden');
    to.inert = false;
    to.scrollTop = 0;
    S.camKey = to.dataset.cam;
    S.corrTarget = parseFloat(to.dataset.corr || '0.1');
    teaserSync();

    railItems.forEach(function (li, k) { li.classList.toggle('is-here', k === i); });
    document.body.dataset.scene = to.id;
    hint.classList.toggle('is-on', i === 0);
    if (!opts.silent) {
      try { history.replaceState(null, '', i === 0 ? location.pathname + location.search : '#' + to.id); } catch (err) {}
      sfx.whoosh(dir);
    }
    locked = true;
    setTimeout(function () { locked = false; }, reduceMotion ? 300 : 1000);
  }
  function next() { go(index + 1); }
  function prev() { go(index - 1); }

  /* ------------------------------------------------------------
     Input: wheel, touch, keys. One gesture, one scene.
     ------------------------------------------------------------ */
  function canScroll(el, dir) {
    if (!el || el.scrollHeight <= el.clientHeight + 24) return false;  // a few px of overflow is not a reason to stop paging
    return dir > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 2 : el.scrollTop > 2;
  }
  function blocked() { return !!$('.reel[open]'); }

  var lastWheel = 0, wheelAcc = 0, consumed = false;
  window.addEventListener('wheel', function (e) {
    if (blocked()) return;
    var dir = e.deltaY > 0 ? 1 : -1;
    if (canScroll(scenes[index], dir)) { lastWheel = performance.now(); return; }
    e.preventDefault();
    var t = performance.now();
    var gap = t - lastWheel;
    lastWheel = t;
    // a trackpad keeps firing after a flick; swallow that tail until it stops
    if (locked || (consumed && gap < 200)) return;
    if (gap >= 200) { consumed = false; wheelAcc = 0; }
    // Firefox reports lines (deltaMode 1) or pages (2), not pixels
    wheelAcc += e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1);
    if (Math.abs(wheelAcc) > 35) { consumed = true; wheelAcc = 0; go(index + dir); }
  }, { passive: false });

  var touchY = null, touchTop = 0;
  window.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) return;
    touchY = e.touches[0].clientY; touchTop = scenes[index].scrollTop;
  }, { passive: true });
  window.addEventListener('touchend', function (e) {
    if (touchY === null || blocked()) return;
    var dy = touchY - e.changedTouches[0].clientY;
    var sc = scenes[index];
    touchY = null;
    if (Math.abs(dy) < 50 || locked) return;
    if (Math.abs(sc.scrollTop - touchTop) > 4) return;  // they were scrolling the scene itself
    var dir = dy > 0 ? 1 : -1;
    if (canScroll(sc, dir)) return;
    go(index + dir);
  }, { passive: true });

  window.addEventListener('keydown', function (e) {
    if (blocked() || e.altKey || e.ctrlKey || e.metaKey) return;
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    var k = e.key;
    if (k === 'ArrowDown' || k === 'PageDown' || (k === ' ' && tag !== 'button' && tag !== 'a')) { e.preventDefault(); if (!locked) next(); }
    else if (k === 'ArrowUp' || k === 'PageUp') { e.preventDefault(); if (!locked) prev(); }
    else if (k === 'Home') { e.preventDefault(); go(0); }
    else if (k === 'End') { e.preventDefault(); go(scenes.length - 1); }
  });

  window.addEventListener('hashchange', function () {
    var i = sceneIndex(location.hash.slice(1));
    if (i >= 0) go(i);
  });
  function sceneIndex(id) { for (var i = 0; i < scenes.length; i++) if (scenes[i].id === id) return i; return -1; }

  /* ------------------------------------------------------------
     Footage: each [data-reel] button opens the dialog it names.
     A dialog holds a <video>, or a [data-yt] box that gets its
     YouTube player only while open (closing it stops playback).
     The page's own sound ducks while a reel plays.
     ------------------------------------------------------------ */
  (function () {
    function ytFrame(box) {
      var f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + box.dataset.yt + '?autoplay=1&rel=0&playsinline=1';
      f.title = box.dataset.ytTitle || 'CardAlive video';
      f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      f.allowFullscreen = true;
      f.referrerPolicy = 'strict-origin-when-cross-origin';
      box.appendChild(f);
    }
    $$('.reel').forEach(function (dlg) {
      var vid = $('video', dlg), yt = $('[data-yt]', dlg);
      function stop() { if (vid) vid.pause(); if (yt) yt.textContent = ''; }
      function close() { stop(); if (dlg.close) dlg.close(); else { dlg.removeAttribute('open'); closed(); } }
      function closed() { stop(); sfx.duck(false); teaserSync(); }
      $('.reel__close', dlg).addEventListener('click', close);
      dlg.addEventListener('click', function (e) { if (e.target === dlg) close(); });
      dlg.addEventListener('close', closed);
    });
    $$('[data-reel]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var dlg = document.getElementById(btn.dataset.reel), vid = $('video', dlg), yt = $('[data-yt]', dlg);
        if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
        sfx.duck(true); teaserSync();
        if (yt && !yt.firstChild) ytFrame(yt);
        if (vid) { var p = vid.play(); if (p && p.catch) p.catch(function () {}); }
      });
    });
  })();

  /* Hero teaser: the trailer as a muted loop while the hero is on screen, a still frame under reduced motion */
  var teaser = document.getElementById('teaser');
  var pageLoaded = document.readyState === 'complete';
  function teaserSync() {
    if (!teaser) return;
    if (pageLoaded && index === 0 && !reduceMotion && !STILL && !document.hidden && !blocked() && teaser.offsetWidth) {
      teaser.preload = 'auto';
      var p = teaser.play(); if (p && p.catch) p.catch(function () {});
    } else teaser.pause();
  }
  window.addEventListener('load', function () { pageLoaded = true; teaserSync(); });
  document.addEventListener('visibilitychange', teaserSync);
  var teaserResize = 0;
  window.addEventListener('resize', function () { clearTimeout(teaserResize); teaserResize = setTimeout(teaserSync, 200); });

  /* ------------------------------------------------------------
     Sound — synthesised, off until asked for
     ------------------------------------------------------------ */
  var sfx = (function () {
    var ctx = null, master = null, on = false, noiseBuf = null;
    function init() {
      if (ctx) return true;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      ambience();
      return true;
    }
    function noise() { var s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; return s; }
    function ambience() {
      var amb = ctx.createGain(); amb.gain.value = 0.55; amb.connect(master);
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260; lp.Q.value = 0.7; lp.connect(amb);
      [55, 55.4, 82.4, 110.2].forEach(function (f, i) {
        var o = ctx.createOscillator(); o.type = i < 2 ? 'sawtooth' : 'triangle'; o.frequency.value = f;
        var g = ctx.createGain(); g.gain.value = i < 2 ? 0.08 : 0.05;
        o.connect(g); g.connect(lp); o.start();
      });
      var lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
      var lg = ctx.createGain(); lg.gain.value = 120; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
      var n = noise(); var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.6;
      var wg = ctx.createGain(); wg.gain.value = 0.05; n.connect(bp); bp.connect(wg); wg.connect(amb); n.start();
      var wl = ctx.createOscillator(); wl.frequency.value = 0.05; var wlg = ctx.createGain(); wlg.gain.value = 300;
      wl.connect(wlg); wlg.connect(bp.frequency); wl.start();
      setInterval(function () { if (on && !document.hidden) bell(); }, 17000);
    }
    function env(g, t, a, peak, dec) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
    }
    function bell() {
      var t = ctx.currentTime;
      [196, 392.5, 587, 784, 1046].forEach(function (f, i) {
        var o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * (1 + i * 0.003);
        var g = ctx.createGain(); env(g, t, 0.01, 0.08 / (i + 1), 5 - i * 0.7);
        o.connect(g); g.connect(master); o.start(t); o.stop(t + 6);
      });
    }
    function tone(type, f0, f1, dur, peak) {
      var t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      env(g, t, 0.01, peak, dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.1);
    }
    function burst(freq, q, dur, peak, sweepTo) {
      var t = ctx.currentTime, n = noise(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      f.type = 'bandpass'; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
      if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
      env(g, t, sweepTo ? dur * 0.45 : 0.005, peak, sweepTo ? dur * 0.55 : dur);
      n.connect(f); f.connect(g); g.connect(master); n.start(t); n.stop(t + dur + 0.1);
    }
    function ok() { return on && ctx; }
    return {
      toggle: function () {
        if (!init()) return false;
        on = !on;
        if (ctx.state === 'suspended') ctx.resume();
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setTargetAtTime(on ? 0.7 : 0, ctx.currentTime, 0.4);
        return on;
      },
      duck: function (down) {
        if (!ctx) return;
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setTargetAtTime(on && !down ? 0.7 : 0, ctx.currentTime, 0.3);
      },
      whoosh: function (dir) { if (ok()) burst(dir > 0 ? 300 : 1400, 0.9, 1.1, 0.16, dir > 0 ? 1400 : 300); },
      tick: function () { if (ok()) tone('triangle', 1200, 900, 0.06, 0.05); },
      shimmer: function () { if (!ok()) return; [880, 1320, 1760].forEach(function (f, i) { setTimeout(function () { tone('sine', f, f * 1.01, 0.6, 0.04); }, i * 60); }); },
      thunder: function () { if (ok()) burst(90, 0.3, 2.8, 0.45); }
    };
  })();

  var soundBtn = $('#sound');
  soundBtn.addEventListener('click', function () {
    var on = sfx.toggle();
    soundBtn.setAttribute('aria-pressed', String(!!on));
    soundBtn.setAttribute('aria-label', on ? 'Turn sound off' : 'Turn sound on');
  });
  document.addEventListener('ca:thunder', function () { sfx.thunder(); });
  document.addEventListener('ca:sfx', function (e) { if (sfx[e.detail]) sfx[e.detail](); });

  /* ------------------------------------------------------------
     Per-frame: corruption easing, flight cue
     ------------------------------------------------------------ */
  S.corrTarget = 0.1;
  (function frame() {
    S.corr += (S.corrTarget - S.corr) * 0.05;
    document.body.classList.toggle('is-flying', !!S.flying);
    requestAnimationFrame(frame);
  })();

  /* ------------------------------------------------------------
     Boot
     ------------------------------------------------------------ */
  var summoning = $('#summoning');
  var bootAt = performance.now(), lifted = false;
  function lift() {
    if (lifted) return; lifted = true;
    var wait = STILL ? 0 : Math.max(0, 1100 - (performance.now() - bootAt));
    setTimeout(function () {
      summoning.classList.add('is-done');
      document.body.classList.add('is-loaded');
    }, wait);
  }
  document.addEventListener('ca:ready', lift);
  document.addEventListener('ca:fail', function () { document.body.classList.add('no-webgl'); lift(); });
  setTimeout(lift, STILL ? 0 : 4500);
  // the city's module comes from a CDN; if it never starts, paint the fallback sky
  setTimeout(function () { if (!S.worldStarted) document.body.classList.add('no-webgl'); }, 6000);

  scenes.forEach(function (sc) { sc.setAttribute('aria-hidden', 'true'); sc.inert = true; });
  var start = 0;
  if (CAM) start = Math.max(0, sceneIndex(CAM));
  else if (location.hash) start = Math.max(0, sceneIndex(location.hash.slice(1)));
  go(start, { silent: true, force: true });
  S.corr = S.corrTarget;
  S.snap = true;
})();
