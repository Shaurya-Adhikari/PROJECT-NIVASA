const express = require('express');
const { redirectIfAuthed } = require('../middleware/auth');
const E = require('../shared/engine');

const router = express.Router();

// ---------- "What we ask" rulers: two sample students on every question ----------
const PAIR = {
  a: { name: 'Riya', meta: '2nd year CSE',
    answers: { room: 0, bed: 1, wake: 1, lights: 0, clean: 2, study: 0, friends: 0, sharing: 1, temp: 1, food: 1, smoke: 0, vibe: 1, top: 'bed' } },
  b: { name: 'Kavya', meta: '2nd year Civil',
    answers: { room: 0, bed: 2, wake: 1, lights: 1, clean: 2, study: 1, friends: 1, sharing: 1, temp: 1, food: 2, smoke: 1, vibe: 1, top: 'study' } },
};

const WHY = {
  room: 'Double or triple. Different answers never meet.',
  bed: 'The number one roommate complaint.',
  wake: '8am lectures versus afternoon labs.',
  lights: 'Pitch dark, or a desk lamp till 3.',
  clean: 'Your side of the room, honestly.',
  study: 'Silence, soft music, or calls on speaker.',
  friends: 'How often the room becomes the hangout.',
  sharing: 'Chargers, buckets, the last packet of Maggi.',
  temp: 'Fan on full versus the one under a blanket.',
  food: 'What is allowed to live in the room.',
  smoke: 'Smokers never see someone who asked for smoke free.',
  vibe: 'Keep to yourself, or best friends by week two.',
};

function buildRulers() {
  const { a, b } = PAIR;
  const result = E.compatibility(a.answers, b.answers);

  const rows = E.QUESTIONS.map((q, i) => {
    const av = a.answers[q.id];
    const bv = b.answers[q.id];
    const n = q.options.length;
    const base = { id: q.id, num: String(i + 1).padStart(2, '0'), title: q.title, why: WHY[q.id] };

    if (q.kind === 'must') {
      const ok = !E.blockedBy({ [q.id]: av }, { [q.id]: bv });
      return Object.assign(base, {
        must: true,
        ok,
        options: q.options.map((o, j) => ({ label: o[1], a: j === av, b: j === bv })),
        aLabel: q.options[av][1],
        bLabel: q.options[bv][1],
      });
    }

    const sim = result.sims[q.id];
    const pos = (v) => (v / (n - 1)) * 100;
    const lo = Math.min(pos(av), pos(bv));
    const hi = Math.max(pos(av), pos(bv));
    return Object.assign(base, {
      weight: q.weight,
      ticks: q.options.map((o, j) => ({ pos: pos(j) })),
      start: q.options[0][1],
      end: q.options[n - 1][1],
      aPos: pos(av),
      bPos: pos(bv),
      same: av === bv,
      gapLeft: lo,
      gapWidth: hi - lo,
      aLabel: q.options[av][1],
      bLabel: q.options[bv][1],
      sim: Math.round(sim * 100),
      tone: sim === 1 ? 'same' : sim >= 0.75 ? 'close' : 'talk',
    });
  });

  return { a, b, rows, score: result.score };
}

const RULERS = buildRulers();

// ---------- Hero match slip: Riya and Sneha on four habits ----------
function buildSlip() {
  const sneha = { name: 'Sneha', meta: '2nd year ECE',
    answers: { room: 0, bed: 1, wake: 1, lights: 0, clean: 2, study: 0, friends: 1, sharing: 1, temp: 1, food: 1, smoke: 0, vibe: 1, top: 'bed' } };
  const a = PAIR.a;
  const result = E.compatibility(a.answers, sneha.answers);
  const rows = ['bed', 'lights', 'study', 'friends'].map((id) => {
    const q = E.BY_ID[id];
    const n = q.options.length;
    const pos = (v) => (v / (n - 1)) * 100;
    const av = a.answers[id];
    const bv = sneha.answers[id];
    const sim = result.sims[id];
    return {
      title: q.title,
      aPos: pos(av),
      bPos: pos(bv),
      same: av === bv,
      gapLeft: Math.min(pos(av), pos(bv)),
      gapWidth: Math.abs(pos(av) - pos(bv)),
      tone: sim === 1 ? 'same' : sim >= 0.75 ? 'close' : 'talk',
      note: av === bv ? q.options[av][1] : 'Talk first',
    };
  });
  return { a, b: sneha, rows, score: result.score };
}

const SLIP = buildSlip();

router.get('/', (req, res) => {
  res.render('home', { page: 'home', rulers: RULERS, slip: SLIP });
});

router.get('/login', redirectIfAuthed, (req, res) => {
  // Only allow same site redirects after login
  const next = typeof req.query.next === 'string' && req.query.next.startsWith('/') && !req.query.next.startsWith('//')
    ? req.query.next : '/#matches';
  res.render('login', { title: 'Log in', page: 'auth', next });
});

router.get('/signup', redirectIfAuthed, (req, res) => {
  res.render('signup', { title: 'Create your account', page: 'auth' });
});

// Simple content pages linked from the footer
const PAGES = {
  about: {
    title: 'About',
    body: [
      'NIVASA is a hostel roommate matching project built by students. Instead of random allotment, you answer 13 quick questions about sleep, study and room habits and see which students in your hostel you would get along with.',
      'Scores are calculated from how close your answers are, weighted by what each of you says matters most. Room type and smoking are must match answers: if they differ, you never see each other.',
    ],
  },
  privacy: {
    title: 'Privacy policy',
    body: [
      'We store your name, college email, hostel, year, branch and quiz answers. Your answers are only used to calculate match scores for students in the same college and hostel.',
      'Your email is only shown to another student after you both accept a room request. We never sell or share your data with third parties.',
      'To delete your account and answers, email hello@nivasa.in from your college email.',
    ],
  },
  terms: {
    title: 'Terms of use',
    body: [
      'NIVASA is for current students only. Sign up with your own college email and answer honestly.',
      'NIVASA does not allot rooms. Final allotment is always decided by your hostel office.',
      'Be respectful. Accounts that harass other students will be removed.',
    ],
  },
};

Object.entries(PAGES).forEach(([slug, content]) => {
  router.get('/' + slug, (req, res) => res.render('page', { ...content, page: slug }));
});

module.exports = router;
