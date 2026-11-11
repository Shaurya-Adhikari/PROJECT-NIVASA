// NIVASA — login and signup forms: client side checks, then the JSON API.
(function () {
  'use strict';

  const ANSWERS_KEY = 'nivasa-room-quiz';
  const form = document.querySelector('[data-auth]');
  if (!form) return;

  const mode = form.dataset.auth;
  const formError = form.querySelector('.form-error');
  const submit = form.querySelector('button[type="submit"]');
  const COLLEGE_RE = /^[^\s@]+@[^\s@]+\.(ac\.in|edu|edu\.in)$/i;

  // Quiz answers taken before signing up travel with the new account
  let localAnswers = null;
  try { localAnswers = JSON.parse(localStorage.getItem(ANSWERS_KEY) || 'null'); } catch (e) {}
  const note = document.querySelector('[data-answers-note]');
  if (note && localAnswers && Object.keys(localAnswers).length) note.hidden = false;

  function setError(name, msg) {
    const el = form.querySelector('[data-error-for="' + name + '"]');
    const input = form.elements[name];
    if (el) el.textContent = msg || '';
    if (input) input.setAttribute('aria-invalid', String(Boolean(msg)));
  }

  function validate() {
    const v = (n) => (form.elements[n] ? form.elements[n].value.trim() : '');
    const errors = {};
    if (!v('email')) errors.email = 'Enter your college email.';
    else if (!COLLEGE_RE.test(v('email'))) errors.email = 'Use your college email, the one ending in .ac.in or .edu.';
    if (!form.elements.password.value) errors.password = 'Enter your password.';

    if (mode === 'signup') {
      if (!v('name')) errors.name = 'Enter your name.';
      if (!v('year')) errors.year = 'Pick your year.';
      if (!v('branch')) errors.branch = 'Enter your branch.';
      if (!v('hostel')) errors.hostel = 'Enter your hostel name.';
      if (form.elements.password.value && form.elements.password.value.length < 8) errors.password = 'Use at least 8 characters.';
    }

    ['name', 'email', 'year', 'branch', 'hostel', 'password'].forEach((n) => setError(n, errors[n]));
    return errors;
  }

  // Clear a field's error as soon as it is edited
  form.addEventListener('input', (e) => {
    if (e.target.name && e.target.getAttribute('aria-invalid') === 'true') setError(e.target.name, '');
    formError.textContent = '';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    formError.textContent = '';

    const errors = validate();
    const first = Object.keys(errors)[0];
    if (first) {
      form.elements[first].focus();
      return;
    }

    const body = {};
    Array.from(form.elements).forEach((el) => { if (el.name) body[el.name] = el.value; });
    if (mode === 'signup' && localAnswers) body.answers = localAnswers;

    submit.disabled = true;
    submit.setAttribute('aria-busy', 'true');
    const res = await window.nivasaApi('/api/auth/' + mode, { method: 'POST', body });
    submit.disabled = false;
    submit.removeAttribute('aria-busy');

    if (!res.ok) {
      if (res.data.fields) Object.entries(res.data.fields).forEach(([k, msg]) => setError(k, msg));
      formError.textContent = res.data.error || 'That didn\'t work. Try again.';
      return;
    }

    if (mode === 'signup') {
      try { localStorage.removeItem(ANSWERS_KEY); } catch (err) {}
    }
    window.location.href = mode === 'login' ? (form.dataset.next || '/#matches') : '/#quiz';
  });
})();
