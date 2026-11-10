const Profile = require('../models/Profile');
const { QUESTIONS, sanitize } = require('../shared/engine');

// GET /api/quiz — the question set, so other clients can render the cards
function questions(req, res) {
  res.json({ questions: QUESTIONS });
}

// PUT /api/quiz — save answers. Partial saves are fine; omitted cards stay as
// they were, and a value of null clears that card.
async function saveAnswers(req, res) {
  const raw = (req.body && req.body.answers) || {};
  const clean = sanitize(raw);

  const set = {};
  const unset = {};
  Object.entries(clean).forEach(([k, v]) => { set['answers.' + k] = v; });
  Object.keys(raw).forEach((k) => {
    if (raw[k] === null && (k === 'top' || QUESTIONS.some((q) => q.id === k))) unset['answers.' + k] = '';
  });

  const update = {};
  if (Object.keys(set).length) update.$set = set;
  if (Object.keys(unset).length) update.$unset = unset;

  const profile = await Profile.findOneAndUpdate(
    { user: req.user._id },
    Object.keys(update).length ? update : { $setOnInsert: { answers: {} } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );

  if (!profile.completedAt && profile.answeredCount() === QUESTIONS.length && profile.answers.top) {
    profile.completedAt = new Date();
    await profile.save();
  }

  res.json({ answers: profile.answers.toObject(), complete: Boolean(profile.completedAt) });
}

module.exports = { questions, saveAnswers };
