require('dotenv').config();

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const helmet = require('helmet');
const { engine } = require('express-handlebars');
const mongoose = require('mongoose');

const { connectDB, disconnectDB } = require('./config/db');
const { loadUser } = require('./middleware/auth');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const pageRoutes = require('./routes/pages');
const apiRoutes = require('./routes/api');

const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

async function start() {
  await connectDB();

  const app = express();
  if (isProd) app.set('trust proxy', 1);

  // ---------- Views ----------
  app.engine('hbs', engine({
    extname: '.hbs',
    defaultLayout: 'main',
    helpers: {
      eq: (a, b) => a === b,
      year: () => new Date().getFullYear(),
      inc: (i) => String(i + 1).padStart(2, '0'),
    },
  }));
  app.set('view engine', 'hbs');
  app.set('views', path.join(__dirname, 'views'));

  // ---------- Security headers ----------
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://unpkg.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://unpkg.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://unpkg.com'],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
      },
    },
  }));

  // ---------- Static files ----------
  app.use(express.static(path.join(__dirname, 'public'), { index: false, maxAge: isProd ? '7d' : 0 }));
  // The scoring engine is shared with the browser
  app.use('/shared', express.static(path.join(__dirname, 'shared'), { maxAge: isProd ? '7d' : 0 }));

  // ---------- Body parsing and sessions ----------
  app.use(express.json({ limit: '20kb' }));

  let secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (isProd) throw new Error('SESSION_SECRET is not set.');
    secret = crypto.randomBytes(32).toString('hex');
    console.warn('[session] SESSION_SECRET not set, using a random one. Sessions reset on restart.');
  }

  app.use(session({
    name: 'nivasa.sid',
    secret,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ client: mongoose.connection.getClient(), ttl: 14 * 24 * 60 * 60 }),
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      maxAge: 14 * 24 * 60 * 60 * 1000,
    },
  }));

  app.use(loadUser);

  // ---------- Routes ----------
  app.use('/api', apiRoutes);
  app.use('/', pageRoutes);

  app.use(notFound);
  app.use(errorHandler);

  const server = app.listen(PORT, () => console.log('[server] NIVASA running at http://localhost:' + PORT));

  // Close cleanly so the embedded database flushes its data
  let closing = false;
  const shutdown = async (signal) => {
    if (closing) return;
    closing = true;
    console.log('[server] ' + signal + ' received, shutting down');
    server.close();
    await disconnectDB().catch(() => {});
    process.exit(0);
  };
  ['SIGINT', 'SIGTERM', 'SIGUSR2'].forEach((sig) => process.once(sig, () => shutdown(sig)));
}

start().catch((err) => {
  console.error('[server] failed to start:', err.message);
  process.exit(1);
});
