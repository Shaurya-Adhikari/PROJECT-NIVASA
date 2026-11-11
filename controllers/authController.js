const User = require('../models/User');
const Profile = require('../models/Profile');
const { sanitize } = require('../shared/engine');
const { HttpError } = require('../middleware/errorHandler');

function str(v) {
  return typeof v === 'string' ? v.trim() : '';
}

// Regenerate the session on sign in to prevent session fixation
function startSession(req, user) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.userId = user._id.toString();
      req.session.save((err2) => (err2 ? reject(err2) : resolve()));
    });
  });
}

async function signup(req, res) {
  const body = req.body || {};
  const name = str(body.name);
  const email = str(body.email).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  const hostel = str(body.hostel);
  const branch = str(body.branch);
  const year = Number(body.year);

  const fields = {};
  if (!name) fields.name = 'Enter your name.';
  if (!User.COLLEGE_EMAIL.test(email)) fields.email = 'Use your college email, the one ending in .ac.in or .edu.';
  if (password.length < 8) fields.password = 'Use at least 8 characters.';
  if (!hostel) fields.hostel = 'Enter your hostel name.';
  if (!branch) fields.branch = 'Enter your branch.';
  if (!Number.isInteger(year) || year < 1 || year > 5) fields.year = 'Pick your year.';
  if (Object.keys(fields).length) throw new HttpError(400, 'Some fields need fixing.', fields);

  const user = new User({ name, email, hostel, branch, year });
  await user.setPassword(password);
  await user.save();

  // Answers taken before signing up (kept in the browser) come along
  const answers = sanitize(body.answers);
  await Profile.create({ user: user._id, answers });

  await startSession(req, user);
  res.status(201).json({ user: user.toPublic() });
}

async function login(req, res) {
  const email = str((req.body || {}).email).toLowerCase();
  const password = typeof (req.body || {}).password === 'string' ? req.body.password : '';

  const user = email ? await User.findOne({ email }).select('+passwordHash') : null;
  // Same message either way so emails can't be probed
  if (!user || !(await user.checkPassword(password))) {
    throw new HttpError(401, 'That email and password don\'t match. Check both and try again.');
  }

  await startSession(req, user);
  res.json({ user: user.toPublic() });
}

function logout(req, res, next) {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('nivasa.sid');
    res.json({ ok: true });
  });
}

async function me(req, res) {
  const profile = await Profile.findOne({ user: req.user._id });
  res.json({ user: req.user.toPublic(), answers: profile ? profile.answers.toObject() : {} });
}

module.exports = { signup, login, logout, me };
