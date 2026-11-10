const mongoose = require('mongoose');
const User = require('../models/User');
const Profile = require('../models/Profile');
const Match = require('../models/Match');
const { SCALE, FILTERS, compatibility, explain } = require('../shared/engine');
const { HttpError } = require('../middleware/errorHandler');

// Request state between the signed in user and each other student
async function requestsByOther(userId) {
  const docs = await Match.find({ $or: [{ from: userId }, { to: userId }] }).lean();
  const map = new Map();
  docs.forEach((m) => {
    const outgoing = m.from.equals(userId);
    const other = (outgoing ? m.to : m.from).toString();
    // Keep the most recent active request for the pair
    const prev = map.get(other);
    if (!prev || m.updatedAt > prev.updatedAt) {
      map.set(other, { id: m._id.toString(), status: m.status, direction: outgoing ? 'outgoing' : 'incoming', updatedAt: m.updatedAt });
    }
  });
  return map;
}

// GET /api/matches?filter=night — scored students from the same hostel
async function list(req, res) {
  const me = req.user;
  const filterName = FILTERS[req.query.filter] ? req.query.filter : 'all';
  const minScore = req.query.filter === 'top' ? 80 : 0;
  const myProfile = await Profile.findOne({ user: me._id }).lean();
  const mine = (myProfile && myProfile.answers) || {};

  if (!SCALE.some((q) => mine[q.id] != null)) {
    return res.json({ matches: [], total: 0, hidden: 0, needsAnswers: true });
  }

  const others = await User.find({
    _id: { $ne: me._id },
    collegeDomain: me.collegeDomain,
    hostel: new RegExp('^' + me.hostel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i'),
  }).lean();

  const profiles = await Profile.find({ user: { $in: others.map((u) => u._id) } }).lean();
  const answersByUser = new Map(profiles.map((p) => [p.user.toString(), p.answers || {}]));
  const requests = await requestsByOther(me._id);

  let hidden = 0;
  const matches = [];
  others.forEach((u) => {
    const theirs = answersByUser.get(u._id.toString());
    if (!theirs) return; // hasn't started the quiz yet

    const result = compatibility(mine, theirs);
    if (result.blocked) { hidden++; return; }
    if (result.score == null) return; // no overlapping answered cards
    if (!FILTERS[filterName](theirs) || result.score < minScore) return;

    const request = requests.get(u._id.toString()) || null;
    matches.push({
      id: u._id.toString(),
      name: u.name,
      meta: ordinal(u.year) + ' year · ' + u.branch,
      score: result.score,
      ...explain(result.sims, theirs),
      request: request && { id: request.id, status: request.status, direction: request.direction },
      // Contact details only once both sides have agreed
      email: request && request.status === 'accepted' ? u.email : undefined,
    });
  });

  matches.sort((a, b) => b.score - a.score);
  res.json({ matches, total: matches.length + hidden, hidden, needsAnswers: false });
}

function ordinal(n) {
  return n + (['th', 'st', 'nd', 'rd'][n] || 'th');
}

// POST /api/requests { to } — send a room request
async function sendRequest(req, res) {
  const toId = (req.body || {}).to;
  if (!mongoose.isValidObjectId(toId) || toId === req.user._id.toString()) {
    throw new HttpError(400, 'Pick a student to send the request to.');
  }

  const other = await User.findById(toId);
  if (!other || other.collegeDomain !== req.user.collegeDomain || other.hostel.toLowerCase() !== req.user.hostel.toLowerCase()) {
    throw new HttpError(404, 'That student is not in your hostel.');
  }

  const [mine, theirs] = await Promise.all([
    Profile.findOne({ user: req.user._id }).lean(),
    Profile.findOne({ user: other._id }).lean(),
  ]);
  const result = compatibility((mine && mine.answers) || {}, (theirs && theirs.answers) || {});
  if (result.blocked) throw new HttpError(409, 'You can\'t send a request because one of your must match answers is different.');

  // They already asked you: accept theirs instead of creating a second one
  const reverse = await Match.findOne({ from: other._id, to: req.user._id, status: 'pending' });
  if (reverse) {
    reverse.status = 'accepted';
    reverse.respondedAt = new Date();
    await reverse.save();
    return res.json({ request: { id: reverse.id, status: 'accepted', direction: 'incoming' } });
  }

  const existing = await Match.findOne({ from: req.user._id, to: other._id });
  if (existing && ['pending', 'accepted'].includes(existing.status)) {
    return res.json({ request: { id: existing.id, status: existing.status, direction: 'outgoing' } });
  }

  const match = await Match.findOneAndUpdate(
    { from: req.user._id, to: other._id },
    { $set: { status: 'pending', scoreAtRequest: result.score ?? undefined, respondedAt: null } },
    { new: true, upsert: true, runValidators: true }
  );
  res.status(201).json({ request: { id: match.id, status: match.status, direction: 'outgoing' } });
}

// GET /api/requests — incoming and outgoing requests with names
async function listRequests(req, res) {
  const docs = await Match.find({ $or: [{ from: req.user._id }, { to: req.user._id }], status: { $ne: 'cancelled' } })
    .sort({ updatedAt: -1 })
    .populate('from', 'name year branch email')
    .populate('to', 'name year branch email')
    .lean();

  const shape = (m, outgoing) => {
    const other = outgoing ? m.to : m.from;
    return {
      id: m._id.toString(),
      status: m.status,
      score: m.scoreAtRequest,
      student: {
        id: other._id.toString(),
        name: other.name,
        meta: ordinal(other.year) + ' year · ' + other.branch,
        email: m.status === 'accepted' ? other.email : undefined,
      },
      updatedAt: m.updatedAt,
    };
  };

  res.json({
    incoming: docs.filter((m) => m.to._id.equals(req.user._id)).map((m) => shape(m, false)),
    outgoing: docs.filter((m) => m.from._id.equals(req.user._id)).map((m) => shape(m, true)),
  });
}

// PATCH /api/requests/:id { status } — accept, decline or cancel
async function updateRequest(req, res) {
  const status = (req.body || {}).status;
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(404, 'That request does not exist.');
  const match = await Match.findById(req.params.id);
  if (!match) throw new HttpError(404, 'That request does not exist.');

  const isRecipient = match.to.equals(req.user._id);
  const isSender = match.from.equals(req.user._id);
  const allowed = (isRecipient && ['accepted', 'declined'].includes(status)) || (isSender && status === 'cancelled');
  if (!allowed) throw new HttpError(403, 'You can\'t make that change to this request.');
  if (match.status !== 'pending') throw new HttpError(409, 'This request was already answered.');

  match.status = status;
  match.respondedAt = new Date();
  await match.save();
  res.json({ request: { id: match.id, status: match.status } });
}

module.exports = { list, sendRequest, listRequests, updateRequest };
