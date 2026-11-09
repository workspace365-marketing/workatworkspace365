/* Interactie voor Werken bij Workspace 365. Geen dependencies. */
(function () {
  'use strict';

  // 1. Zachte intro-animatie bij scrollen
  try {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var els = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));
    if (!reduce && 'IntersectionObserver' in window) {
      els.forEach(function (el) { el.classList.add('zw-reveal'); });
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add('zw-in'); io.unobserve(en.target); }
        });
      }, { threshold: 0.05, rootMargin: '0px 0px -40px 0px' });
      els.forEach(function (el) { io.observe(el); });
    }
  } catch (e) {}

  // 2. Homepage: drie werkwijzen
  var stepBtns = document.querySelectorAll('[data-step]');
  if (stepBtns.length && window.__STEPS) {
    var title = document.getElementById('wb-step-title');
    var list = document.getElementById('wb-step-points');
    var select = function (i) {
      stepBtns.forEach(function (b) {
        var on = Number(b.getAttribute('data-step')) === i;
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        b.style.background = on ? '#FCE7EE' : '#ffffff';
        b.style.borderColor = on ? '#540047' : '#EEE6ED';
      });
      var s = window.__STEPS[i];
      title.textContent = s.title;
      list.innerHTML = s.points.map(function (p) {
        return window.__STEP_LI.replace('{{ pt.text }}', p.replace(/&/g, '&amp;').replace(/</g, '&lt;'));
      }).join('');
    };
    stepBtns.forEach(function (b) {
      b.addEventListener('click', function () { select(Number(b.getAttribute('data-step'))); });
    });
  }

  // 3. Vacatures filteren
  var filterBtns = document.querySelectorAll('[data-filter]');
  if (filterBtns.length) {
    var cards = document.querySelectorAll('a[data-kind]');
    filterBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        var f = b.getAttribute('data-filter');
        filterBtns.forEach(function (x) {
          var on = x === b;
          x.setAttribute('aria-pressed', on ? 'true' : 'false');
          x.style.background = on ? '#540047' : '#ffffff';
          x.style.color = on ? '#ffffff' : '#540047';
          x.style.borderColor = on ? '#540047' : '#EEE6ED';
        });
        cards.forEach(function (c) {
          c.style.display = (f === 'all' || c.getAttribute('data-kind') === f) ? '' : 'none';
        });
      });
    });
  }

  // 4. Teams: portretten met uitleg
  var modal = document.getElementById('person-modal');
  if (modal && window.__PEOPLE) {
    var lastFocus = null;
    var open = function (i, trigger) {
      var p = window.__PEOPLE[i];
      lastFocus = trigger;
      modal.querySelectorAll('[data-f]').forEach(function (el) { el.textContent = p[el.getAttribute('data-f')] || ''; });
      var img = modal.querySelector('[data-f-img]');
      img.src = p.img; img.alt = p.name;
      modal.hidden = false;
      var close = modal.querySelector('button[data-close]:last-of-type');
      if (close) close.focus();
    };
    var close = function () { modal.hidden = true; if (lastFocus) lastFocus.focus(); };
    document.querySelectorAll('[data-person]').forEach(function (b) {
      b.addEventListener('click', function () { open(Number(b.getAttribute('data-person')), b); });
    });
    modal.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', close); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hidden) close(); });
  }

  // 5. Contactformulier (Netlify Forms)
  var form = document.getElementById('contact-form');
  if (form) {
    var wrap = document.getElementById('form-wrap');
    var sent = document.getElementById('sent-panel');
    var reset = document.getElementById('reset-form');
    var error = document.createElement('p');
    error.setAttribute('role', 'alert');
    error.style.cssText = 'color:#A6124B;font-weight:700;margin:0;';
    error.hidden = true;
    form.appendChild(error);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      error.hidden = true;
      var btn = form.querySelector('button[type=submit]');
      if (btn) btn.disabled = true;
      fetch('/', { method: 'POST', body: new FormData(form) })
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          wrap.hidden = true; sent.hidden = false; form.reset();
          sent.scrollIntoView({ behavior: 'smooth', block: 'center' });
        })
        .catch(function () { error.textContent = form.getAttribute('data-error'); error.hidden = false; })
        .then(function () { if (btn) btn.disabled = false; });
    });
    if (reset) reset.addEventListener('click', function () { sent.hidden = true; wrap.hidden = false; });
  }
})();
