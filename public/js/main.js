// NIVASA — home page: tagline reveal, card by card room quiz, matches feed
// and room requests. Signed in users talk to the API; visitors get a local
// demo with sample students. Scoring comes from /shared/engine.js.
(function () {
  'use strict';

  const E = window.NivasaEngine;
  const api = window.nivasaApi;
  const ANSWERS_KEY = 'nivasa-room-quiz';
  const signedIn = document.body.dataset.signedIn === 'true';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---------- Current section in nav ----------
  const navLinks = document.querySelectorAll('.nav-link[href^="/#"]');
  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      navLinks.forEach((a) => {
        if (a.hash === '#' + entry.target.id) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  navLinks.forEach((a) => {
    const target = document.querySelector(a.hash);
    if (target) sectionObserver.observe(target);
  });

  // ---------- Tagline: words light up one at a time ----------
  const tagline = document.querySelector('[data-reveal-words]');
  if (tagline) {
    const words = tagline.textContent.trim().split(/\s+/);
    tagline.textContent = '';
    words.forEach((w, i) => {
      const span = document.createElement('span');
      span.className = 'word';
      span.textContent = w;
      tagline.appendChild(span);
      if (i < words.length - 1) tagline.appendChild(document.createTextNode(' '));
    });
    tagline.setAttribute('aria-label', words.join(' '));

    const spans = tagline.querySelectorAll('.word');
    let ticking = false;

    function updateWords() {
      ticking = false;
      const trigger = window.innerHeight * 0.7; // words activate as they cross this line
      let remaining = 0;
      spans.forEach((s) => {
        if (s.classList.contains('is-on')) return;
        if (s.getBoundingClientRect().top < trigger) s.classList.add('is-on');
        else remaining++;
      });
      if (!remaining) window.removeEventListener('scroll', onScroll);
    }

    function onScroll() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(updateWords);
      }
    }

    if (reduceMotion.matches) {
      spans.forEach((s) => s.classList.add('is-on'));
    } else {
      window.addEventListener('scroll', onScroll, { passive: true });
      updateWords();
    }
  }

  // Last card: which habit matters most (counts double)
  const TOP_CARD = {
    id: 'top', kind: 'pick', icon: 'ph-star', title: 'Matters most',
    q: 'Which one matters most to you in a roommate?',
    options: E.SCALE.map((q) => [q.title, q.title, q.id]),
  };
  const CARDS = E.QUESTIONS.concat(TOP_CARD);

  // ---------- Sample students for the signed out demo ----------
  const STUDENTS = [
    { id: 's1', name: 'Sneha Nair', meta: '2nd year · ECE', color: 'blue',
      a: { room: 0, bed: 1, wake: 1, lights: 0, clean: 2, study: 0, friends: 1, sharing: 1, temp: 1, food: 1, smoke: 0, vibe: 1, top: 'bed' } },
    { id: 's2', name: 'Ananya Gupta', meta: '1st year · Mechanical', color: 'green',
      a: { room: 0, bed: 0, wake: 0, lights: 0, clean: 3, study: 0, friends: 0, sharing: 0, temp: 2, food: 0, smoke: 0, vibe: 0, top: 'clean' } },
    { id: 's3', name: 'Priya Menon', meta: '3rd year · CSE', color: 'violet',
      a: { room: 0, bed: 3, wake: 2, lights: 2, clean: 1, study: 2, friends: 2, sharing: 2, temp: 0, food: 2, smoke: 1, vibe: 2, top: 'friends' } },
    { id: 's4', name: 'Kavya Reddy', meta: '2nd year · Civil', color: 'amber',
      a: { room: 0, bed: 2, wake: 1, lights: 1, clean: 2, study: 1, friends: 1, sharing: 1, temp: 1, food: 2, smoke: 1, vibe: 1, top: 'study' } },
    { id: 's5', name: 'Ishita Joshi', meta: '4th year · Chemical', color: 'rose',
      a: { room: 1, bed: 1, wake: 1, lights: 0, clean: 2, study: 0, friends: 1, sharing: 1, temp: 1, food: 0, smoke: 0, vibe: 1, top: 'lights' } },
    { id: 's6', name: 'Meghna Das', meta: '2nd year · IT', color: 'orange',
      a: { room: 0, bed: 2, wake: 2, lights: 1, clean: 1, study: 1, friends: 2, sharing: 2, temp: 0, food: 2, smoke: 2, vibe: 2, top: 'friends' } },
  ];

  // ---------- Answers state ----------
  let answers = {};
  if (!signedIn) {
    try { answers = E.sanitize(JSON.parse(localStorage.getItem(ANSWERS_KEY) || '{}')); } catch (e) {}
  }

  // Signed in: save to the API shortly after each pick, batching quick taps
  let pending = {};
  let saveTimer = null;
  function queueSave(id, value) {
    if (!signedIn) {
      try { localStorage.setItem(ANSWERS_KEY, JSON.stringify(answers)); } catch (e) {}
      renderFeed();
      return;
    }
    pending[id] = value;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSave, 400);
  }

  async function flushSave() {
    const batch = pending;
    pending = {};
    const res = await api('/api/quiz', { method: 'PUT', body: { answers: batch } });
    setSaveStatus(res.ok ? 'Saved to your account' : (res.data.error || 'Could not save. Check your connection.'), !res.ok);
    if (res.ok) renderFeed();
  }

  // ---------- Quiz rendering ----------
  // Scale and must match questions render as a ruler of stops (radio inputs);
  // the "matters most" pick renders as a row of pills.
  const form = document.getElementById('quiz-form');
  const countEl = document.querySelector('.quiz-count');
  const ticksEl = document.querySelector('.quiz-ticks');
  const backBtn = document.querySelector('[data-quiz="back"]');
  const nextBtn = document.querySelector('[data-quiz="next"]');
  const TOTAL = CARDS.length;
  const DONE = TOTAL; // index of the summary panel
  const pad = (n) => String(n).padStart(2, '0');
  let step = 0;

  function cardHTML(card, i) {
    const n = card.options.length;
    let body;

    if (card.kind === 'pick') {
      body = '<div class="pick-grid">' + card.options.map((o) =>
        '<label class="pick"><input type="radio" name="top" value="' + o[2] + '"><span class="pick-body button-sm">' + esc(o[0]) + '</span></label>'
      ).join('') + '</div>';
    } else {
      body = '<div class="scale" style="--n: ' + n + '">' + card.options.map((o, j) =>
        '<label class="stop"><input type="radio" name="' + card.id + '" value="' + j + '">' +
        '<span class="stop-dot" aria-hidden="true"></span>' +
        '<span class="stop-label body-5">' + esc(o[0]) + '</span></label>'
      ).join('') + '</div>';
    }

    const kind = card.kind === 'must' ? '<span class="q-tag q-tag--must caption-3">Must match</span>'
      : card.kind === 'pick' ? '<span class="q-tag caption-3">Counts double</span>'
      : '<span class="q-tag caption-3">Counts ×' + E.BY_ID[card.id].weight + '</span>';

    return '<fieldset class="q-panel" data-step="' + i + '" tabindex="-1" hidden>' +
      '<legend class="q-legend"><span class="q-meta"><span class="q-title caption-3 muted">' + esc(card.title) + '</span>' + kind + '</span>' +
      '<span class="q-question heading-4">' + esc(card.q) + '</span></legend>' +
      body +
      '<button class="q-skip caption-2" type="button" data-quiz="next">Skip this one</button>' +
      '</fieldset>';
  }

  const doneActions = signedIn
    ? '<div class="done-actions"><a class="btn btn-primary button-md" href="#matches">See my ranking</a>' +
      '<p class="form-status caption-2" role="status" aria-live="polite"></p></div>'
    : '<div class="done-actions"><a class="btn btn-primary button-md" href="/signup">Create account and save these</a>' +
      '<p class="caption-2 muted">Saved on this device for now. Already signed up? <a class="text-link" href="/login?next=%2F%23matches">Log in</a></p></div>';

  form.innerHTML = CARDS.map(cardHTML).join('') +
    '<div class="q-panel q-done" data-step="' + DONE + '" tabindex="-1" hidden>' +
      '<div class="q-legend"><span class="q-title caption-3 muted">Your room profile</span>' +
      '<h3 class="q-question heading-4">That is everything. Tap any line to change it.</h3></div>' +
      '<ol class="spec" role="list"></ol>' + doneActions +
    '</div>';

  ticksEl.innerHTML = CARDS.map((c, i) =>
    '<li><button class="qtick" type="button" data-goto-step="' + i + '" aria-label="Question ' + (i + 1) + ': ' + esc(c.title) + '"></button></li>'
  ).join('');
  const tickBtns = Array.from(ticksEl.querySelectorAll('.qtick'));

  const cards = Array.from(form.querySelectorAll('[data-step]'));
  const specEl = form.querySelector('.spec');
  const statusEl = form.querySelector('.form-status');

  function setSaveStatus(msg, isError) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.style.color = isError ? 'var(--danger)' : '';
  }

  function syncChecked() {
    CARDS.forEach((card) => {
      const v = answers[card.id];
      form.querySelectorAll('input[name="' + card.id + '"]').forEach((input) => {
        input.checked = v != null && String(v) === input.value;
      });
    });
  }

  function syncTicks() {
    tickBtns.forEach((b, i) => {
      b.classList.toggle('is-done', answers[CARDS[i].id] != null);
      if (i === step) b.setAttribute('aria-current', 'step');
      else b.removeAttribute('aria-current');
    });
  }

  function renderSummary() {
    specEl.innerHTML = CARDS.map((card, i) => {
      const v = answers[card.id];
      const text = v == null ? 'Skipped'
        : card.kind === 'pick' ? E.BY_ID[v].title
        : card.options[v][0];
      return '<li><button type="button" data-goto-step="' + i + '"' + (v == null ? ' class="is-skipped"' : '') + '>' +
        '<span class="spec-num caption-3">' + pad(i + 1) + '</span>' +
        '<span class="spec-key caption-2 muted">' + esc(card.title) + '</span>' +
        '<span class="spec-val body-5">' + esc(text) + '</span></button></li>';
    }).join('');
  }

  function goTo(next, focus) {
    next = Math.max(0, Math.min(DONE, next));
    const dir = next >= step ? 'is-entering' : 'is-entering-back';
    step = next;

    cards.forEach((c) => { c.hidden = Number(c.dataset.step) !== step; });
    const current = cards[step];
    if (step === DONE) renderSummary();

    if (!reduceMotion.matches) {
      current.classList.add(dir);
      requestAnimationFrame(() => requestAnimationFrame(() => current.classList.remove(dir)));
    }

    countEl.textContent = step === DONE ? 'Done' : pad(step + 1) + ' / ' + TOTAL;
    syncTicks();
    backBtn.disabled = step === 0;
    nextBtn.hidden = step === DONE;
    nextBtn.firstChild.textContent = step === TOTAL - 1 ? 'Finish' : 'Next';

    if (focus) current.focus({ preventScroll: true });
  }

  // Mouse and touch picks advance automatically; keyboard users press Next or Enter
  let pointerPick = false;
  form.addEventListener('pointerdown', (e) => { if (e.target.closest('.stop, .pick')) pointerPick = true; });

  form.addEventListener('change', (e) => {
    const input = e.target;
    if (input.type !== 'radio') return;
    const value = input.name === 'top' ? input.value : Number(input.value);
    answers[input.name] = value;
    queueSave(input.name, value);
    syncTicks();

    if (pointerPick) {
      const from = step;
      setTimeout(() => { if (step === from) goTo(step + 1, true); }, 280);
    }
    pointerPick = false;
  });

  // Enter on a question card moves forward
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (step !== DONE) goTo(step + 1, true);
  });

  document.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-quiz]');
    if (nav) {
      goTo(step + (nav.dataset.quiz === 'back' ? -1 : 1), true);
      return;
    }
    const jump = e.target.closest('[data-goto-step]');
    if (jump) {
      goTo(Number(jump.dataset.gotoStep), true);
      return;
    }
    const tile = e.target.closest('[data-goto]');
    if (tile) goTo(CARDS.findIndex((c) => c.id === tile.dataset.goto), false);
  });

  // ---------- Matches feed ----------
  const list = document.querySelector('.match-list');
  const tabs = document.querySelectorAll('.filter-tabs .tab');
  const resultsEl = document.querySelector('.results-count');
  const states = {
    start: document.querySelector('[data-state="start"]'),
    none: document.querySelector('[data-state="none"]'),
    filtered: document.querySelector('[data-state="filtered"]'),
  };
  let activeFilter = 'all';
  let feedToken = 0;

  function showState(name) {
    Object.entries(states).forEach(([k, el]) => { if (el) el.hidden = k !== name; });
  }

  // Placeholder cards shaped like the real ones while the API answers
  function skeleton() {
    const one = '<li class="mcard skeleton" aria-hidden="true"><div class="mcard-face">' +
      '<div class="sk-head"><span class="sk-col"><span class="sk sk-line"></span><span class="sk sk-line sk-short"></span></span>' +
      '<span class="sk sk-ring"></span></div><span class="sk sk-line"></span><span class="sk sk-line sk-short"></span></div></li>';
    list.innerHTML = one + one + one;
    list.hidden = false;
  }

  function requestAction(m) {
    if (!signedIn) {
      return '<a class="btn btn-secondary button-sm" href="/signup">Sign up to request</a>';
    }
    const r = m.request;
    if (r && r.status === 'accepted') {
      return '<p class="agreed caption-1"><span class="stamp caption-3">Roommates</span><a class="text-link" href="mailto:' + esc(m.email) + '">' + esc(m.email) + '</a></p>';
    }
    if (r && r.status === 'pending' && r.direction === 'incoming') {
      return '<button class="btn btn-primary button-sm" type="button" data-respond="' + r.id + '" data-status="accepted">Accept their request</button>';
    }
    if (r && r.status === 'pending') {
      return '<button class="btn btn-secondary button-sm is-sent" type="button" data-respond="' + r.id + '" data-status="cancelled">' +
        '<span class="ph ph-check" aria-hidden="true"></span>Sent · undo</button>';
    }
    return '<button class="btn btn-primary button-sm" type="button" data-request="' + esc(m.id) + '">Send room request</button>';
  }

  // Percentage ring: an SVG circle whose stroke length is the score
  function ringHTML(score) {
    const C = 2 * Math.PI * 34;
    const tier = score >= 80 ? 'high' : score >= 60 ? 'mid' : 'low';
    return '<span class="ring ring--' + tier + '" aria-hidden="true"><svg viewBox="0 0 80 80" width="80" height="80">' +
      '<circle class="ring-bg" cx="40" cy="40" r="34"/>' +
      '<circle class="ring-fg" cx="40" cy="40" r="34" stroke-dasharray="' + (C * score / 100).toFixed(1) + ' ' + C.toFixed(1) + '"/>' +
      '</svg><span class="ring-num">' + score + '<small>%</small></span></span>';
  }

  // My answer for a habit, as the short label used on tags
  function mine(id) {
    const v = answers[id];
    return v == null ? 'Skipped' : E.BY_ID[id].options[v][1];
  }

  function matchCardHTML(m, i) {
    const shared = m.strip.filter((s) => s.sim === 100).slice(0, 3);
    const first = m.name.split(/\s+/)[0];
    const cardId = 'mc-' + esc(m.id);

    const front =
      '<div class="mcard-face mcard-front">' +
        '<div class="mcard-head">' +
          '<div><p class="caption-3 mcard-rank">#' + (i + 1) + ' match</p><h3 class="title-1">' + esc(m.name) + '</h3><p class="caption-2 muted">' + esc(m.meta) + '</p></div>' +
          ringHTML(m.score) +
        '</div>' +
        (shared.length
          ? '<p class="caption-4 muted mcard-sub">You both picked</p><ul class="chips" role="list">' +
            shared.map((s) => '<li class="chip-same caption-1"><span class="ph ph-check" aria-hidden="true"></span>' + esc(s.theirs) + '</li>').join('') + '</ul>'
          : '') +
        (m.talk ? '<p class="mcard-talk caption-1"><span class="ph ph-chat-circle-dots" aria-hidden="true"></span>' + esc(m.talk) + '</p>' : '') +
        '<div class="mcard-actions">' + requestAction(m) +
          '<button class="btn-text button-sm" type="button" data-flip="' + cardId + '" aria-pressed="false">' +
          '<span class="ph ph-arrows-clockwise" aria-hidden="true"></span>Compare answers</button></div>' +
      '</div>';

    const back =
      '<div class="mcard-face mcard-back" inert>' +
        '<div class="compare-head caption-3"><span>Habit</span><span><span class="dot dot--a" aria-hidden="true"></span>You</span>' +
          '<span><span class="dot dot--b" aria-hidden="true"></span>' + esc(first) + '</span></div>' +
        '<ul class="compare" role="list">' +
          m.strip.map((s) => {
            const tone = s.sim == null ? 'none' : s.sim === 100 ? 'same' : s.sim >= 75 ? 'close' : 'talk';
            return '<li class="cmp cmp--' + tone + '"><span class="caption-2 muted">' + esc(s.title) + '</span>' +
              '<span class="caption-1">' + esc(mine(s.id)) + '</span>' +
              '<span class="caption-1">' + esc(s.theirs || 'Skipped') + '</span></li>';
          }).join('') +
        '</ul>' +
        '<div class="mcard-actions"><span class="caption-2 muted">No clash on room type or smoking</span>' +
          '<button class="btn-text button-sm" type="button" data-flip="' + cardId + '" aria-pressed="true">' +
          '<span class="ph ph-arrow-u-up-left" aria-hidden="true"></span>Back</button></div>' +
      '</div>';

    return '<li class="mcard" id="' + cardId + '" style="--i: ' + i + '" aria-label="' + esc(m.name) + ', ' + m.score + ' percent match">' +
      '<div class="mcard-inner">' + front + back + '</div></li>';
  }

  // Flip a card between its summary and the side by side comparison
  function flip(card) {
    const flipped = !card.classList.contains('is-flipped');
    card.classList.toggle('is-flipped', flipped);
    const front = card.querySelector('.mcard-front');
    const back = card.querySelector('.mcard-back');
    front.inert = flipped;
    back.inert = !flipped;
    (flipped ? back : front).querySelector('[data-flip]').focus({ preventScroll: true });
  }

  // Signed out: score the sample students in the browser
  function localMatches() {
    let hidden = 0;
    const rows = [];
    STUDENTS.forEach((s) => {
      const r = E.compatibility(answers, s.a);
      if (r.blocked) { hidden++; return; }
      if (r.score == null) return;
      const passes = activeFilter === 'top' ? r.score >= 80 : (E.FILTERS[activeFilter] || E.FILTERS.all)(s.a);
      if (!passes) return;
      rows.push(Object.assign({ id: s.id, name: s.name, meta: s.meta, score: r.score }, E.explain(r.sims, s.a)));
    });
    rows.sort((a, b) => b.score - a.score);
    return { matches: rows, total: rows.length + hidden, hidden, needsAnswers: false };
  }

  async function renderFeed() {
    const token = ++feedToken;
    const answeredScale = E.SCALE.some((q) => answers[q.id] != null);
    if (!answeredScale) {
      list.hidden = true;
      resultsEl.textContent = '';
      showState('start');
      return;
    }

    let data;
    if (signedIn) {
      if (list.hidden || !list.children.length) skeleton();
      const res = await api('/api/matches?filter=' + encodeURIComponent(activeFilter));
      if (token !== feedToken) return; // a newer render started
      if (!res.ok) {
        list.hidden = true;
        resultsEl.textContent = res.data.error || 'Could not load matches. Refresh to try again.';
        return;
      }
      data = res.data;
    } else {
      data = localMatches();
    }

    list.innerHTML = data.matches.map(matchCardHTML).join('');
    list.hidden = data.matches.length === 0;

    if (data.needsAnswers) showState('start');
    else if (data.matches.length) showState(null);
    else if (data.total === 0 && activeFilter === 'all') showState('none');
    else showState('filtered');

    resultsEl.textContent = data.total
      ? data.matches.length + ' of ' + data.total + ' students' +
        (data.hidden ? ' · ' + data.hidden + ' hidden by must match' : '')
      : '';
  }

  // ---------- Room requests panel (signed in) ----------
  const requestsEl = document.querySelector('[data-requests]');

  async function renderRequests() {
    if (!requestsEl) return;
    const res = await api('/api/requests');
    if (!res.ok) return;
    const incoming = res.data.incoming.filter((r) => r.status === 'pending');
    const agreed = res.data.incoming.concat(res.data.outgoing).filter((r) => r.status === 'accepted');
    const items = incoming.map((r) =>
      '<li class="request-item"><div><p class="title-4">' + esc(r.student.name) + ' wants to room with you</p>' +
      '<p class="caption-2 muted">' + esc(r.student.meta) + (r.score != null ? ' · ' + r.score + '% match' : '') + '</p></div>' +
      '<div class="request-actions">' +
        '<button class="btn btn-primary button-sm" type="button" data-respond="' + r.id + '" data-status="accepted">Accept</button>' +
        '<button class="btn btn-secondary button-sm" type="button" data-respond="' + r.id + '" data-status="declined">Decline</button>' +
      '</div></li>'
    ).concat(agreed.map((r) =>
      '<li class="request-item"><div><p class="title-4">You and ' + esc(r.student.name) + ' agreed to room together</p>' +
      '<p class="caption-2 muted">' + esc(r.student.meta) + '</p></div>' +
      '<a class="status-pill caption-3" data-status="accepted" href="mailto:' + esc(r.student.email) + '">' + esc(r.student.email) + '</a></li>'
    ));
    requestsEl.querySelector('.request-list').innerHTML = items.join('');
    requestsEl.hidden = items.length === 0;
  }

  document.addEventListener('click', async (e) => {
    const chip = e.target.closest('[data-filter]');
    if (chip) {
      activeFilter = chip.dataset.filter;
      tabs.forEach((t) => t.setAttribute('aria-pressed', String(t.dataset.filter === activeFilter)));
      renderFeed();
      return;
    }

    const flipBtn = e.target.closest('[data-flip]');
    if (flipBtn) {
      flip(document.getElementById(flipBtn.dataset.flip));
      return;
    }

    const send = e.target.closest('[data-request]');
    const respond = e.target.closest('[data-respond]');
    if (!send && !respond) return;

    const btn = send || respond;
    btn.disabled = true;
    const res = send
      ? await api('/api/requests', { method: 'POST', body: { to: send.dataset.request } })
      : await api('/api/requests/' + respond.dataset.respond, { method: 'PATCH', body: { status: respond.dataset.status } });
    btn.disabled = false;

    if (!res.ok) {
      resultsEl.textContent = res.data.error || 'That didn\'t work. Try again.';
      return;
    }
    await Promise.all([renderFeed(), renderRequests()]);
  });

  // ---------- Start ----------
  async function init() {
    if (signedIn) {
      const res = await api('/api/me');
      if (res.ok) answers = E.sanitize(res.data.answers);
      renderRequests();
    }
    syncChecked();
    // Resume at the first unanswered card
    const firstOpen = CARDS.findIndex((c) => answers[c.id] == null);
    goTo(firstOpen === -1 ? DONE : firstOpen, false);
    renderFeed();
  }

  init();
})();
