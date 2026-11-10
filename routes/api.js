const express = require('express');
const rateLimit = require('express-rate-limit');
const { requireApiAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const auth = require('../controllers/authController');
const quiz = require('../controllers/quizController');
const matches = require('../controllers/matchController');

const router = express.Router();

// Slow down password guessing and signup spam
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Wait 15 minutes and try again.' },
});

// Auth
router.post('/auth/signup', authLimiter, asyncHandler(auth.signup));
router.post('/auth/login', authLimiter, asyncHandler(auth.login));
router.post('/auth/logout', auth.logout);
router.get('/me', requireApiAuth, asyncHandler(auth.me));

// Quiz
router.get('/quiz', quiz.questions);
router.put('/quiz', requireApiAuth, asyncHandler(quiz.saveAnswers));

// Matches feed and room requests
router.get('/matches', requireApiAuth, asyncHandler(matches.list));
router.get('/requests', requireApiAuth, asyncHandler(matches.listRequests));
router.post('/requests', requireApiAuth, asyncHandler(matches.sendRequest));
router.patch('/requests/:id', requireApiAuth, asyncHandler(matches.updateRequest));

module.exports = router;
