/* CardAlive — email forms (vanilla, no deps), shared by the home page and /publishers/.
   There is no backend: FormSubmit relays every field of a form[data-raven] to the inbox
   in its action. Sounds are requested with a ca:sfx event, which main.js plays if it is
   on the page. */
(function () {
  'use strict';

  var INBOX = 'cardalive@protonmail.com';
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function sfx(name) { document.dispatchEvent(new CustomEvent('ca:sfx', { detail: name })); }

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
      if (document.activeElement && form.contains(document.activeElement)) document.activeElement.blur();
      sfx('shimmer');
    }
    function fail() {
      say('The raven was lost. Try again, or write to ', true);
      var a = document.createElement('a');
      a.href = 'mailto:' + INBOX; a.textContent = INBOX;
      status.appendChild(a);
      status.appendChild(document.createTextNode('.'));
      sfx('tick');
    }

    input.addEventListener('input', function () { if (status.classList.contains('is-err')) say(''); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy || form.classList.contains('is-sent')) return;
      var addr = input.value.trim();
      if (!EMAIL.test(addr)) { say('That does not look like an email address.', true); input.focus(); sfx('tick'); return; }

      var data = {};
      new FormData(form).forEach(function (v, k) { data[k] = typeof v === 'string' ? v.trim() : v; });
      if (data._honey) { done(addr); return; }  // only a bot fills the hidden field
      data.email = addr;
      data._replyto = addr;
      data._subject = form.dataset.subject + ': ' + addr;
      data._template = 'table';

      busy = true; send.disabled = true; form.classList.add('is-busy');
      say('Sending…');
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
