// NIVASA — shared on every page: theme toggle, mobile menu, scroll reveals,
// log out, and a small fetch helper for the JSON API.
(function () {
  'use strict';

  const root = document.documentElement;
  const THEME_KEY = 'nivasa-theme';

  // ---------- API helper ----------
  // Resolves to { ok, status, data } and never throws on HTTP errors
  window.nivasaApi = async function api(path, options) {
    const opts = Object.assign({ method: 'GET', headers: {} }, options);
    if (opts.body && typeof opts.body !== 'string') {
      opts.body = JSON.stringify(opts.body);
      opts.headers['Content-Type'] = 'application/json';
    }
    opts.credentials = 'same-origin';
    try {
      const res = await fetch(path, opts);
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    } catch (err) {
      return { ok: false, status: 0, data: { error: 'Could not reach the server. Check your connection and try again.' } };
    }
  };

  // ---------- Theme toggle ----------
  const themeBtn = document.querySelector('.theme-toggle');
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

  function isDark() {
    const forced = root.getAttribute('data-theme');
    return forced ? forced === 'dark' : systemDark.matches;
  }

  function syncThemeButton() {
    const dark = isDark();
    themeBtn.setAttribute('aria-pressed', String(dark));
    themeBtn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
  }

  themeBtn.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    syncThemeButton();
  });
  systemDark.addEventListener('change', syncThemeButton);
  syncThemeButton();

  // ---------- Mobile menu ----------
  const menuBtn = document.querySelector('.menu-toggle');
  const menu = document.getElementById('mobile-menu');

  // Stagger: 60ms per item, capped so the sequence never exceeds 400ms
  menu.querySelectorAll('.mobile-list li').forEach((li, i) => li.style.setProperty('--i', Math.min(i, 400 / 60)));

  function setMenu(open) {
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.style.overflow = open ? 'hidden' : '';

    if (open) {
      menu.hidden = false;
      requestAnimationFrame(() => {
        menu.classList.add('is-open');
        menu.querySelector('a, button').focus({ preventScroll: true });
      });
    } else {
      menu.classList.remove('is-open');
      setTimeout(() => { if (!menu.classList.contains('is-open')) menu.hidden = true; }, 300);
    }
  }

  menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menuBtn.getAttribute('aria-expanded') === 'true') {
      setMenu(false);
      menuBtn.focus();
    }
  });
  window.matchMedia('(min-width: 900px)').addEventListener('change', (e) => {
    if (e.matches) setMenu(false);
  });

  // ---------- Scroll reveals (once per section) ----------
  const revealObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      obs.unobserve(entry.target);
    });
  }, { threshold: 0.08 });
  document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));

  // ---------- Log out ----------
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-logout]');
    if (!btn) return;
    btn.disabled = true;
    await window.nivasaApi('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  });
})();
