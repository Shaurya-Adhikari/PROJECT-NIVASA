// Gives route handlers a single place to send expected errors from
class HttpError extends Error {
  constructor(status, message, fields) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

// Wraps async handlers so rejected promises reach the error handler
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function notFound(req, res) {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'That endpoint does not exist.' });
  res.status(404).render('404', { title: 'Page not found' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = err.status || 500;
  let message = err.message;
  let fields = err.fields;

  // Mongoose validation → 400 with per field messages
  if (err.name === 'ValidationError') {
    status = 400;
    fields = Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v.message]));
    message = 'Some fields need fixing.';
  }
  // Duplicate key (email already registered, request already sent)
  if (err.code === 11000) {
    status = 409;
    message = err.keyPattern && err.keyPattern.email
      ? 'An account with that email already exists. Try logging in.'
      : 'That already exists.';
  }

  if (status >= 500) {
    console.error(err);
    message = 'Something went wrong on our side. Try again in a minute.';
  }

  if (req.path.startsWith('/api/')) return res.status(status).json({ error: message, fields });
  res.status(status).render('error', { title: 'Something went wrong', status, message });
}

module.exports = { HttpError, asyncHandler, notFound, errorHandler };
