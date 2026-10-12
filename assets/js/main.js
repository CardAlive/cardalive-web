/* CardAlive — page behaviour (vanilla, no deps).
   The page is a fixed stage of six scenes. One wheel flick, swipe or key
   press moves one scene; the camera flies there through the city while
   the text dissolves out and back in. Shared state for world.js lives
   in window.CA: the camera keyframe, corruption, the light-span, the
   Veil Dive and the fight. Everything here works without WebGL. */
(function () {
  'use strict';

  var S = (window.CA = window.CA || {});
  S.camKey = 'hero'; S.corr = 0.1; S.span = 0; S.veil = false; S.boss = 0; S.withdrawn = false; S.hit = 0;

  var params = new URLSearchParams(location.search);
  var STILL = params.has('still');            // screenshots: no intro, no stagger, no auto-tour
  var CAM = params.get('cam');                // screenshots: open on one scene, stop or scale
  // Motion follows the OS setting, but a visitor whose OS asks for reduced motion can opt into the full flights.
  var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  var motionPref = null;
  try { motionPref = localStorage.getItem('ca-motion'); } catch (err) {}
  var reduceMotion = motionQuery.matches && motionPref !== 'full';
  function applyMotion() {
    S.reduceMotion = reduceMotion;
    document.body.classList.toggle('rm', reduceMotion);
    var b = document.getElementById('motion');
    if (!b) return;
    b.hidden = !motionQuery.matches;
    b.setAttribute('aria-pressed', String(!reduceMotion));
    b.querySelector('.motion__label').textContent = reduceMotion ? 'Full motion' : 'Reduce motion';
  }
  applyMotion();
  if (motionQuery.addEventListener) motionQuery.addEventListener('change', function () { reduceMotion = motionQuery.matches && motionPref !== 'full'; applyMotion(); });
  document.getElementById('motion').addEventListener('click', function () {
    reduceMotion = !reduceMotion;
    motionPref = reduceMotion ? 'reduce' : 'full';
    try { localStorage.setItem('ca-motion', motionPref); } catch (err) {}
    applyMotion();
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
     Card: ring of runes, holographic tilt
     ------------------------------------------------------------ */
  (function () {
    var ring = $('#ring-runes');
    if (ring) {
      var runes = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
      var out = '';
      for (var k = 0; k < 36; k++) {
        var a = (k / 36) * Math.PI * 2, r = 179;
        var cx = 200 + Math.cos(a) * r, cy = 200 + Math.sin(a) * r;
        out += '<text x="' + cx.toFixed(1) + '" y="' + cy.toFixed(1) + '" text-anchor="middle" dominant-baseline="middle" transform="rotate(' + (a * 180 / Math.PI + 90).toFixed(1) + ' ' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ')">' + runes.charAt(k % runes.length) + '</text>';
      }
      ring.innerHTML = out;
    }
    var holo = $('#holo'); if (!holo) return;
    var card = $('.holo__card', holo);
    function set(px, py) {
      card.style.setProperty('--ry', ((px - 0.5) * 26).toFixed(2) + 'deg');
      card.style.setProperty('--rx', ((0.5 - py) * 22).toFixed(2) + 'deg');
      card.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
      card.style.setProperty('--my', (py * 100).toFixed(1) + '%');
    }
    holo.addEventListener('pointermove', function (e) {
      var r = holo.getBoundingClientRect();
      set(clamp((e.clientX - r.left) / r.width, 0, 1), clamp((e.clientY - r.top) / r.height, 0, 1));
    });
    holo.addEventListener('pointerenter', function () { sfx.shimmer(); });
    holo.addEventListener('pointerleave', function () { set(0.5, 0.5); });
  })();

  /* ------------------------------------------------------------
     Scenes
     ------------------------------------------------------------ */
  var scenes = $$('.scene');
  var ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
  var index = -1, locked = false;
  var hud = $('#hud'), hint = $('#hint');
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
      leave(from);
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
    enter(to);

    railItems.forEach(function (li, k) { li.classList.toggle('is-here', k === i); });
    document.body.dataset.scene = to.id;
    hint.classList.toggle('is-on', i === 0);
    hud.classList.toggle('is-on', to.id === 'city' || to.id === 'maw');
    if (!opts.silent) {
      try { history.replaceState(null, '', i === 0 ? location.pathname + location.search : '#' + to.id); } catch (err) {}
      sfx.whoosh(dir);
    }
    locked = true;
    setTimeout(function () { locked = false; }, reduceMotion ? 300 : 1000);
  }
  function next() { go(index + 1); }
  function prev() { go(index - 1); }

  function enter(sc) {
    if (sc.id === 'kishi') typeLine($('#sys-line'));
    if (sc.id === 'scales') setScale(currentScale);
    if (sc.id === 'city') startTour(CAM && stopIndex(CAM) >= 0 ? stopIndex(CAM) : 0);
    if (sc.id === 'maw') S.boss = 1;
  }
  function leave(sc) {
    if (sc.id === 'scales') { setVeil(false); document.body.classList.remove('is-diorama'); }
    if (sc.id === 'city') stopTour();
    if (sc.id === 'maw') S.boss = 0;
  }

  /* System window: type the line out once */
  function typeLine(el) {
    if (!el || el.dataset.done || STILL || reduceMotion) return;
    el.dataset.done = '1';
    var full = el.textContent; el.textContent = ' '; el.classList.add('is-typing');
    var n = 0;
    setTimeout(function step() {
      n++; el.textContent = full.slice(0, n);
      if (n % 2 === 0) sfx.blip();
      if (n < full.length) setTimeout(step, 32); else el.classList.remove('is-typing');
    }, 1100);
  }

  /* ------------------------------------------------------------
     Input: wheel, touch, keys. One gesture, one scene.
     ------------------------------------------------------------ */
  function canScroll(el, dir) {
    if (!el || el.scrollHeight <= el.clientHeight + 24) return false;  // a few px of overflow is not a reason to stop paging
    return dir > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 2 : el.scrollTop > 2;
  }
  function blocked() { return $('#footage').open; }

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
     The Pilgrimage: an auto-tour of the road north
     ------------------------------------------------------------ */
  var STOPS = [
    { id: 'lantern', name: 'Lantern Row', places: "Ropewalk · Cooper's Passage · Tanner's Lane", text: 'The last streets where the lamps still burn. Kishi runs ahead. <q>This way. Stay close.</q>', corr: 0.10 },
    { id: 'market', name: 'Weighhouse Market', places: 'Market Square · Weigh Alley · the Market Hall · the Corner Inn', text: 'Where the city once weighed its trade. The square is quiet. Too quiet.', corr: 0.20 },
    { id: 'quay', name: 'Assize Quay', places: 'the Weigh Tower · the Archive · the Assize Hall · the Bridge Gate', text: 'The old courts of the city, and the gate to the only road north.', corr: 0.30 },
    { id: 'underline', name: 'The Underline', places: 'A transit trench · 18 metres deep', text: 'It cuts the city east to west. Its people live in the walls.', corr: 0.40 },
    { id: 'span', name: 'The Great Span', places: 'A 51-metre chasm · a fallen arch', text: 'Carry Kishi over the gap in your hand, and a dead bridge of hard light wakes beneath you.', corr: 0.52, span: true, dwell: 7600 },
    { id: 'cinder', name: 'Cinder Close', places: 'Bridgehead Court · Ash Lane · the Throat', text: 'Ash in the gutters. Roots in the stone. Here the corruption has teeth.', corr: 0.70 },
    { id: 'plaza', name: 'Cathedral Plaza', places: 'the Lych House · the Lych arch', text: 'The last threshold. Doors shut. Windows burning.', corr: 0.86 },
    { id: 'cathedral', name: 'The Cathedral', places: 'Epicentre', text: 'The heart of the city, and the heart of the rot.', corr: 1.00, prompt: true },
  ];
  function stopIndex(id) { for (var i = 0; i < STOPS.length; i++) if (STOPS[i].id === id) return i; return -1; }

  var routeEl = $('#route');
  STOPS.forEach(function (st, i) {
    var li = document.createElement('li');
    li.innerHTML = '<button type="button" data-stop="' + i + '"><span>' + st.name + '</span></button><i class="route__fill"></i>';
    routeEl.appendChild(li);
  });
  var routeItems = $$('li', routeEl);
  routeEl.addEventListener('click', function (e) {
    var b = e.target.closest('[data-stop]');
    if (!b) return;
    touring = false;
    setStop(parseInt(b.dataset.stop, 10));
    sfx.tick();
  });

  var caption = $('.pilgrim__caption');
  var stopName = $('#stop-name'), stopPlaces = $('#stop-places'), stopText = $('#stop-text');
  var spanMeter = $('#spanmeter'), spanBar = $('#span-bar'), spanVal = $('#span-val'), stopPrompt = $('#stop-prompt');
  var touring = false, tourTimer = null, spanRaf = null, swapTimer = null;
  stopPrompt.setAttribute('role', 'button'); stopPrompt.tabIndex = 0;
  stopPrompt.addEventListener('click', function () { go(sceneIndex('maw')); });
  stopPrompt.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); go(sceneIndex('maw')); } });

  function setStop(i, first) {
    var st = STOPS[i];
    S.camKey = st.id;
    S.corrTarget = st.corr;
    if (i < stopIndex('span')) setSpan(0);
    else if (!st.span) setSpan(1);
    routeItems.forEach(function (li, k) {
      li.classList.toggle('is-here', k === i);
      li.classList.toggle('is-past', k < i);
      li.classList.remove('is-touring');
    });
    if (touring && !STILL && i < STOPS.length - 1) {
      var li = routeItems[i];
      li.style.setProperty('--dwell', (st.dwell || 4800) + 'ms');
      void li.offsetWidth;
      li.classList.add('is-touring');
    }
    function fill() {
      stopName.textContent = st.name;
      stopPlaces.textContent = st.places;
      stopText.innerHTML = st.text;
      spanMeter.hidden = !st.span;
      stopPrompt.hidden = !st.prompt;
      caption.classList.remove('is-swap');
    }
    clearTimeout(swapTimer);
    if (first || STILL || reduceMotion) fill();
    else { caption.classList.add('is-swap'); swapTimer = setTimeout(fill, 420); }
    if (st.span) buildSpan();
    clearTimeout(tourTimer);
    if (touring && !STILL && i < STOPS.length - 1) {
      tourTimer = setTimeout(function () { setStop(i + 1); }, st.dwell || 4800);
    }
  }
  function startTour(i) { touring = !STILL; setStop(i, true); }
  function stopTour() { touring = false; clearTimeout(tourTimer); cancelAnimationFrame(spanRaf); }

  function setSpan(p) {
    cancelAnimationFrame(spanRaf);
    S.span = p;
    spanBar.style.setProperty('--p', p.toFixed(3));
    spanVal.textContent = Math.round(p * 100) + '%';
  }
  function buildSpan() {
    setSpan(0);
    if (STILL || reduceMotion) { setSpan(STILL ? 0.73 : 1); return; }
    var t0 = performance.now() + 1600, dur = 4200, lastPlank = -1;
    (function step(t) {
      var p = clamp((t - t0) / dur, 0, 1);
      S.span = p;
      spanBar.style.setProperty('--p', p.toFixed(3));
      spanVal.textContent = Math.round(p * 100) + '%';
      var plank = Math.floor(p * 11);
      if (plank !== lastPlank && p > 0) { lastPlank = plank; sfx.plank(); }
      if (p < 1) spanRaf = requestAnimationFrame(step);
    })(performance.now());
  }

  /* ------------------------------------------------------------
     Scales + Veil Dive
     ------------------------------------------------------------ */
  var currentScale = 'table';
  function inScales() { return scenes[index] && scenes[index].id === 'scales'; }
  function setScale(s) {
    currentScale = s;
    $$('.scales__tabs button').forEach(function (o) { o.setAttribute('aria-selected', String(o.dataset.scale === s)); });
    $$('.scales__panes p').forEach(function (p) { p.hidden = p.dataset.pane !== s; });
    if (inScales()) S.camKey = 'scale-' + s;
    document.body.classList.toggle('is-diorama', s === 'diorama' && inScales());
  }
  $$('.scales__tabs button').forEach(function (b) {
    b.addEventListener('click', function () { setScale(b.dataset.scale); sfx.tick(); });
  });
  var veilBtn = $('#veil-btn'), veilLabel = $('#veil-label');
  function setVeil(on) {
    S.veil = on;
    document.body.classList.toggle('is-veil', on);
    veilBtn.setAttribute('aria-pressed', String(on));
    veilLabel.textContent = on ? 'Surface — leave the Veil' : 'Lean in — Veil Dive';
  }
  veilBtn.addEventListener('click', function () { setVeil(!S.veil); if (S.veil) sfx.woom(); else sfx.tick(); });

  /* ------------------------------------------------------------
     The Maw — a taste of the fight.
     Jaw withdraws at 35% and never dies, as in the tutorial.
     ------------------------------------------------------------ */
  (function () {
    var JAW_MAX = 140, KISHI_MAX = 85;
    var jaw, kishi, charge, riposte, busy, done;
    var jawBar = $('#jaw-hp'), jawLag = $('#jaw-lag'), kBar = $('#kishi-hp');
    var log = $('#fight-log'), layer = $('#dmg-layer'), fight = $('#fight');
    var ult = $('.art--ult'), ultCharge = $('#ult-charge'), banner = $('#banner');
    var arts = $$('.art');
    var names = { slash: 'Rending Slash', cry: "Oathbreaker's Cry", cyclone: 'Abyssal Cyclone' };

    function reset() {
      jaw = JAW_MAX; kishi = KISHI_MAX; charge = 0; riposte = false; busy = false; done = false;
      S.withdrawn = false;
      banner.classList.remove('is-on'); banner.setAttribute('aria-hidden', 'true');
      render(); log.innerHTML = 'Jaw stirs in the wound. Choose an art.';
      arts.forEach(function (a) { a.disabled = false; });
      ult.disabled = true;
    }
    function render() {
      jawBar.style.width = (jaw / JAW_MAX * 100) + '%';
      jawLag.style.width = (jaw / JAW_MAX * 100) + '%';
      kBar.style.width = (kishi / KISHI_MAX * 100) + '%';
      ultCharge.style.width = Math.min(1, charge / 2) * 100 + '%';
      ult.disabled = done || charge < 2;
    }
    function pop(text, cls) {
      var d = document.createElement('span');
      d.className = 'dmg ' + (cls || '');
      d.textContent = text;
      d.style.left = (30 + Math.random() * 40) + '%';
      d.style.top = (20 + Math.random() * 30) + '%';
      layer.appendChild(d);
      setTimeout(function () { d.remove(); }, 1200);
    }
    function slash(ultimate) {
      var s = document.createElement('i');
      s.className = 'slash' + (ultimate ? ' slash--ult' : '');
      s.style.top = (30 + Math.random() * 40) + '%';
      layer.appendChild(s);
      setTimeout(function () { s.remove(); }, 500);
    }
    function shake() {
      if (reduceMotion) return;
      fight.classList.remove('is-shake'); void fight.offsetWidth; fight.classList.add('is-shake');
    }
    function flash() {
      if (reduceMotion) return;
      var f = $('.flash'); f.classList.remove('is-on'); void f.offsetWidth; f.classList.add('is-on');
    }

    arts.forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (busy || done) return;
        busy = true;
        var art = btn.dataset.art;
        var dmg = Math.round(parseInt(btn.dataset.dmg, 10) * (riposte ? 1.5 : 1));
        var wasRiposte = riposte; riposte = false;
        jaw = Math.max(0, jaw - dmg);
        if (art === 'cyclone') charge = 0; else charge++;
        slash(art === 'cyclone'); shake(); flash();
        pop('−' + dmg, art === 'cyclone' ? 'dmg--ult' : (wasRiposte ? 'dmg--riposte' : ''));
        sfx.hit(art === 'cyclone' ? 2 : wasRiposte ? 1.5 : 1);
        S.hit = performance.now();
        log.innerHTML = '<b>' + names[art] + '</b>' + (wasRiposte ? ' &mdash; <span class="parry">Riposte &times;1.5</span>' : '') + ' tears into Jaw for ' + dmg + '.';
        render();

        if (jaw <= JAW_MAX * 0.35) {
          done = true;
          arts.forEach(function (a) { a.disabled = true; });
          setTimeout(function () {
            S.withdrawn = true;
            log.innerHTML = 'Jaw shrieks and folds back into the wound.';
            banner.classList.add('is-on'); banner.setAttribute('aria-hidden', 'false');
            sfx.withdraw();
            busy = false;
          }, 800);
          return;
        }

        setTimeout(function () {
          if (Math.random() < 0.35) {
            riposte = true;
            log.innerHTML = 'Jaw lunges &mdash; <span class="parry">Kishi parries!</span> Your next art ripostes for &times;1.5.';
            pop('PARRY', 'dmg--riposte');
            sfx.parry();
          } else {
            var hurt = 6 + Math.floor(Math.random() * 7);
            kishi = Math.max(1, kishi - hurt);
            log.innerHTML = "Jaw's maw closes on Kishi for " + hurt + '.';
            shake(); sfx.hit(0.6);
          }
          render();
          busy = false;
        }, 750);
      });
    });
    $('#fight-again').addEventListener('click', function () { reset(); sfx.tick(); });
    reset();
  })();

  /* ------------------------------------------------------------
     Email forms (the lantern, the raven). There is no backend:
     FormSubmit relays each address to the inbox in the form's action.
     ------------------------------------------------------------ */
  (function () {
    var INBOX = 'cardalive@protonmail.com';
    var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    $$('form[data-raven]').forEach(function (form) {
      var input = $('input[type="email"]', form), send = $('button[type="submit"]', form), status = $('.raven__status', form);
      var busy = false;

      function say(msg, err) {
        status.textContent = msg;
        status.classList.toggle('is-err', !!err);
      }
      function done(addr) {
        $$('[data-done]', form).forEach(function (el) { el.textContent = el.dataset.done.replace('{email}', addr); });
        status.classList.remove('is-err');
        form.classList.add('is-sent');
        input.blur();
        sfx.shimmer();
      }
      function fail() {
        say('The raven was lost. Try again, or write to ', true);
        var a = document.createElement('a');
        a.href = 'mailto:' + INBOX; a.textContent = INBOX;
        status.appendChild(a);
        status.appendChild(document.createTextNode('.'));
        sfx.tick();
      }

      input.addEventListener('input', function () { if (status.classList.contains('is-err')) say(''); });

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (busy || form.classList.contains('is-sent')) return;
        var addr = input.value.trim();
        if (!EMAIL.test(addr)) { say('That does not look like an email address.', true); input.focus(); sfx.tick(); return; }

        var data = {};
        new FormData(form).forEach(function (v, k) { data[k] = v; });
        if (data._honey) { done(addr); return; }  // only a bot fills the hidden field
        data.email = addr;
        data._replyto = addr;
        data._subject = form.dataset.subject + ': ' + addr;
        data._template = 'table';

        busy = true; send.disabled = true; form.classList.add('is-busy');
        say('Sending\u2026');
        var ctrl = window.AbortController ? new AbortController() : null;
        var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 15000);

        fetch(form.action.replace('://formsubmit.co/', '://formsubmit.co/ajax/'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(data),
          signal: ctrl ? ctrl.signal : undefined
        })
          .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
          .then(function (res) {
            // until the inbox confirms the relay, FormSubmit holds submissions (and says so); they arrive once it is confirmed
            var held = /activat/i.test(res.j.message || '');
            if (res.ok && (String(res.j.success) === 'true' || held)) done(addr); else fail();
          }, fail)
          .then(function () {
            clearTimeout(timer);
            busy = false; send.disabled = false; form.classList.remove('is-busy');
          });
      });
    });
  })();

  /* ------------------------------------------------------------
     Footage
     ------------------------------------------------------------ */
  (function () {
    var dlg = $('#footage'), vid = $('video', dlg);
    $('#footage-open').addEventListener('click', function () {
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
      var p = vid.play(); if (p && p.catch) p.catch(function () {});
    });
    function close() { vid.pause(); if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); }
    $('#footage-close').addEventListener('click', close);
    dlg.addEventListener('click', function (e) { if (e.target === dlg) close(); });
    dlg.addEventListener('close', function () { vid.pause(); });
  })();

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
      whoosh: function (dir) { if (ok()) burst(dir > 0 ? 300 : 1400, 0.9, 1.1, 0.16, dir > 0 ? 1400 : 300); },
      tick: function () { if (ok()) tone('triangle', 1200, 900, 0.06, 0.05); },
      blip: function () { if (ok()) tone('square', 2400, 2300, 0.02, 0.012); },
      shimmer: function () { if (!ok()) return; [880, 1320, 1760].forEach(function (f, i) { setTimeout(function () { tone('sine', f, f * 1.01, 0.6, 0.04); }, i * 60); }); },
      plank: function () { if (ok()) tone('sine', 660 + Math.random() * 200, 990, 0.25, 0.05); },
      woom: function () { if (!ok()) return; tone('sine', 420, 48, 1.6, 0.5); tone('sawtooth', 210, 40, 1.2, 0.08); burst(300, 0.5, 1.4, 0.2); },
      hit: function (k) { if (!ok()) return; burst(1800, 0.8, 0.18 * k, 0.35); tone('sine', 140 * k, 40, 0.35, 0.5); },
      parry: function () { if (!ok()) return; tone('triangle', 2200, 1900, 0.5, 0.18); tone('sine', 3300, 3100, 0.4, 0.08); },
      withdraw: function () { if (!ok()) return; tone('sawtooth', 160, 30, 2.6, 0.16); burst(220, 0.4, 2.4, 0.3); setTimeout(bell, 900); },
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

  /* ------------------------------------------------------------
     Per-frame: corruption meter, flight cue
     ------------------------------------------------------------ */
  var corrVal = $('#corr-val'), corrBar = $('#corr-bar'), lastCorr = '';
  S.corrTarget = 0.1;
  (function frame() {
    S.corr += (S.corrTarget - S.corr) * 0.05;
    var shown = S.withdrawn ? Math.max(0.1, S.corr - 0.35) : S.corr;
    var txt = shown.toFixed(2);
    if (txt !== lastCorr) { corrVal.textContent = txt; corrBar.style.width = (shown * 100).toFixed(1) + '%'; lastCorr = txt; }
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
  if (CAM) {
    if (sceneIndex(CAM) >= 0) start = sceneIndex(CAM);
    else if (stopIndex(CAM) >= 0) start = sceneIndex('city');
    else if (CAM.indexOf('scale-') === 0) { start = sceneIndex('scales'); currentScale = CAM.slice(6); }
  } else if (location.hash) {
    start = Math.max(0, sceneIndex(location.hash.slice(1)));
  }
  go(start, { silent: true, force: true });
  S.corr = S.corrTarget;
  if (CAM && params.has('veil')) setVeil(true);
  S.snap = true;
})();
