const User = require('../models/User');

// Loads the signed in user (if any) onto req.user and res.locals.user
async function loadUser(req, res, next) {
  try {
    if (req.session && req.session.userId) {
      const user = await User.findById(req.session.userId);
      if (user) {
        req.user = user;
        res.locals.user = user.toPublic();
      } else {
        delete req.session.userId;
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}

// API routes: 401 JSON when signed out
function requireApiAuth(req, res, next) {
  if (req.user) return next();
  res.status(401).json({ error: 'Sign in to continue.' });
}

// Page routes: redirect to the login page, then come back
function requirePageAuth(req, res, next) {
  if (req.user) return next();
  res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
}

// Login and signup pages: send signed in users home
function redirectIfAuthed(req, res, next) {
  if (req.user) return res.redirect('/#matches');
  next();
}

module.exports = { loadUser, requireApiAuth, requirePageAuth, redirectIfAuthed };
