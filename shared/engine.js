// NIVASA compatibility engine — shared by the Express server (require) and
// the browser (window.NivasaEngine), so both always score the same way.
//
// kind "must"  → never scored; a mismatch hides the pair entirely
// kind "scale" → options are ordered, similarity = 1 − distance / (n − 1)
// weight       → how much the habit counts; each person's top pick counts ×2
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NivasaEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Each option: [full label shown on the quiz card, short label for tags]
  const QUESTIONS = [
    { id: 'room', kind: 'must', icon: 'ph-bed', title: 'Room type',
      q: 'Which room are you applying for?',
      options: [['Double sharing', 'Double room'], ['Triple sharing', 'Triple room']] },
    { id: 'bed', kind: 'scale', weight: 3, icon: 'ph-moon-stars', title: 'Bedtime',
      q: 'When do you usually fall asleep?',
      options: [['Before 11pm', 'Asleep before 11'], ['11pm to 12:30am', 'Asleep by 12:30'], ['12:30am to 2am', 'Up till 2'], ['After 2am', 'Night owl']] },
    { id: 'wake', kind: 'scale', weight: 1.5, icon: 'ph-alarm', title: 'Wake up time',
      q: 'When do you wake up on a class day?',
      options: [['Before 7am', 'Up before 7'], ['7am to 8:30am', 'Up by 8:30'], ['After 8:30am', 'Late riser']] },
    { id: 'lights', kind: 'scale', weight: 1.5, icon: 'ph-lamp', title: 'Lights at night',
      q: 'What do you need when you are trying to sleep?',
      options: [['Lights fully off', 'Needs dark'], ['A desk lamp is fine', 'Lamp is fine'], ['I can sleep through anything', 'Sleeps anywhere']] },
    { id: 'clean', kind: 'scale', weight: 2.5, icon: 'ph-broom', title: 'Cleanliness',
      q: 'How tidy is your side of the room on a normal day?',
      options: [['Lived in, clothes on the chair', 'Lived in'], ['Mostly tidy', 'Mostly tidy'], ['Neat, everything has a place', 'Neat'], ['Spotless, I clean daily', 'Spotless']] },
    { id: 'study', kind: 'scale', weight: 2.5, icon: 'ph-books', title: 'Study style',
      q: 'How do you study in the room?',
      options: [['Total silence', 'Silent study'], ['Soft music or quiet chatter', 'Soft music'], ['Calls and music out loud', 'Loud study']] },
    { id: 'friends', kind: 'scale', weight: 2, icon: 'ph-users-three', title: 'Friends in the room',
      q: 'How often will friends hang out in your room?',
      options: [['Rarely', 'Friends rarely'], ['A few times a week', 'Friends sometimes'], ['Most evenings', 'Friends most evenings']] },
    { id: 'sharing', kind: 'scale', weight: 1.5, icon: 'ph-handshake', title: 'Sharing stuff',
      q: 'Chargers, buckets, snacks. How do you feel about sharing?',
      options: [['Ask me first, every time', 'Ask first'], ['Small things are fine', 'Shares small things'], ["What's mine is yours", 'Shares everything']] },
    { id: 'temp', kind: 'scale', weight: 1, icon: 'ph-fan', title: 'Fan and window',
      q: 'How do you like the fan at night?',
      options: [['On full, all year', 'Fan on full'], ['Medium is fine', 'Fan medium'], ['I get cold easily', 'Gets cold']] },
    { id: 'food', kind: 'scale', weight: 1.5, icon: 'ph-bowl-food', title: 'Food in the room',
      q: 'What food is okay in the room?',
      options: [['Veg only, please', 'Veg only room'], ['Eggs are fine', 'Eggs fine'], ['Anything goes', 'Anything goes']] },
    { id: 'smoke', kind: 'must', icon: 'ph-cigarette-slash', title: 'Smoking',
      q: 'Smoking or vaping?',
      options: [["I don't, and I want a smoke free roommate", 'Smoke free'], ["I don't, but I don't mind", "Doesn't mind smoke"], ['I do', 'Smokes']] },
    { id: 'vibe', kind: 'scale', weight: 1, icon: 'ph-smiley', title: 'Roommate vibe',
      q: 'What kind of roommate are you?',
      options: [['Quiet, I keep to myself', 'Keeps to self'], ['Friendly, we chat sometimes', 'Friendly'], ["Let's be best friends", 'Wants a best friend']] },
  ];

  const SCALE = QUESTIONS.filter((q) => q.kind === 'scale');
  const BY_ID = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));
  const TOP_IDS = SCALE.map((q) => q.id);

  // Filters for the matches feed, keyed by the chip's data-filter value
  const FILTERS = {
    all: () => true,
    night: (a) => a.bed >= 2,
    early: (a) => a.wake === 0,
    tidy: (a) => a.clean >= 2,
    silent: (a) => a.study === 0,
  };

  // Returns a clean answers object, dropping anything unknown or out of range
  function sanitize(input) {
    const out = {};
    if (!input || typeof input !== 'object') return out;
    QUESTIONS.forEach((q) => {
      const v = input[q.id];
      if (Number.isInteger(v) && v >= 0 && v < q.options.length) out[q.id] = v;
    });
    if (TOP_IDS.includes(input.top)) out.top = input.top;
    return out;
  }

  function blockedBy(a, b) {
    if (a.room != null && b.room != null && a.room !== b.room) return 'room';
    const s = [a.smoke, b.smoke];
    if (s.includes(0) && s.includes(2)) return 'smoke';
    return null;
  }

  function similarities(a, b) {
    const out = {};
    SCALE.forEach((q) => {
      if (a[q.id] == null || b[q.id] == null) return; // skipped cards don't count
      out[q.id] = 1 - Math.abs(a[q.id] - b[q.id]) / (q.options.length - 1);
    });
    return out;
  }

  // How good the match looks from one person's side, using their weights
  function directional(person, sims) {
    let total = 0;
    let weights = 0;
    Object.keys(sims).forEach((id) => {
      const w = BY_ID[id].weight * (person.top === id ? 2 : 1);
      total += sims[id] * w;
      weights += w;
    });
    return weights ? total / weights : 0;
  }

  // Geometric mean: a match only scores high if it works for both people
  function compatibility(a, b) {
    const blocked = blockedBy(a, b);
    if (blocked) return { blocked };
    const sims = similarities(a, b);
    if (!Object.keys(sims).length) return { score: null, sims };
    const score = Math.sqrt(directional(a, sims) * directional(b, sims));
    return { score: Math.round(score * 100), sims };
  }

  // Human readable reasons for a match card
  function explain(sims, other) {
    const ranked = Object.keys(sims).sort((x, y) => sims[y] - sims[x]);
    const good = ranked.slice(0, 2).filter((id) => sims[id] >= 0.5)
      .map((id) => (sims[id] === 1 ? 'Same ' : 'Close on ') + BY_ID[id].title.toLowerCase());
    const worst = ranked[ranked.length - 1];
    const talk = worst && sims[worst] < 0.75 ? 'Talk about: ' + BY_ID[worst].title.toLowerCase() : '';
    const tags = ['bed', 'study', 'clean']
      .filter((id) => other[id] != null)
      .map((id) => BY_ID[id].options[other[id]][1]);
    // One entry per habit, in quiz order; sim is null when either skipped it
    const strip = SCALE.map((q) => ({
      id: q.id,
      title: q.title,
      sim: sims[q.id] == null ? null : Math.round(sims[q.id] * 100),
      theirs: other[q.id] == null ? null : q.options[other[q.id]][1],
    }));
    return { good, talk, tags, strip };
  }

  return { QUESTIONS, SCALE, BY_ID, TOP_IDS, FILTERS, sanitize, blockedBy, similarities, directional, compatibility, explain };
});
