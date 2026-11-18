const path = require('path');
const crypto = require('crypto');
const { createStore } = require('../utils/jsonStore');
const { HttpError } = require('../middleware/errorHandler');

// Feedback is kept in a local JSON file, not MongoDB: data/feedback.json
const store = createStore(process.env.FEEDBACK_FILE || path.join(__dirname, '..', 'data', 'feedback.json'));

// GET /api/feedback — fetch feedback from the JSON file, newest first
async function list(req, res) {
  const all = await store.readAll();
  const rated = all.filter((f) => Number.isInteger(f.rating));
  const average = rated.length ? rated.reduce((sum, f) => sum + f.rating, 0) / rated.length : null;
  res.json({
    feedback: all.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20),
    count: all.length,
    averageRating: average === null ? null : Math.round(average * 10) / 10,
  });
}

// POST /api/feedback { message, rating } — save feedback to the JSON file
async function create(req, res) {
  const body = req.body || {};
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const rating = body.rating === undefined || body.rating === '' ? null : Number(body.rating);

  const fields = {};
  if (message.length < 3) fields.message = 'Write at least a few words.';
  else if (message.length > 500) fields.message = 'Keep it under 500 characters.';
  if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) fields.rating = 'Pick a rating from 1 to 5.';
  if (Object.keys(fields).length) throw new HttpError(400, 'Some fields need fixing.', fields);

  const entry = await store.add({
    id: crypto.randomUUID(),
    message,
    rating,
    name: req.user ? req.user.name : 'Anonymous student',
    createdAt: new Date().toISOString(),
  });
  res.status(201).json({ feedback: entry });
}

module.exports = { list, create };
