const express = require('express');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const config = require('./config');
const { loadUser } = require('./middleware/auth');
const { sanitizeBody, sameOrigin } = require('./middleware/security');
const { notFoundApi, errorHandler } = require('./middleware/errors');

function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://cdn.jsdelivr.net', 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: config.cookieSecure ? [] : null
        }
      },
      crossOriginEmbedderPolicy: false
    })
  );
  app.use(compression());
  if (!config.isTest) app.use(morgan(config.isProd ? 'combined' : 'dev'));

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(sanitizeBody);

  app.use(
    session({
      name: 'connect.sid',
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      store: config.isTest || config.sessionStore === 'memory' ? undefined : MongoStore.create({ mongoUrl: config.mongoUri, ttl: 7 * 24 * 3600 }),
      cookie: {
        secure: config.cookieSecure,
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 7 * 24 * 3600 * 1000
      }
    })
  );

  // ----- API -----
  const api = express.Router();
  api.use(rateLimit({
    windowMs: 60 * 1000,
    limit: config.isTest ? 100000 : 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests, slow down a little' }
  }));
  api.use(sameOrigin);
  api.use(loadUser);

  api.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));
  api.use('/auth', require('./routes/auth'));
  api.use('/posts', require('./routes/posts'));
  api.use('/comments', require('./routes/comments'));
  api.use('/users', require('./routes/users'));
  api.use('/upload', require('./routes/upload'));
  api.use(notFoundApi);
  app.use('/api', api);

  // ----- Static -----
  app.use('/uploads', express.static(config.uploadDir, { maxAge: '7d', index: false, dotfiles: 'deny' }));
  app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'], maxAge: config.isProd ? '1h' : 0 }));

  // Pretty URLs for single posts and profiles
  const page = (f) => (req, res) => res.sendFile(path.join(__dirname, '..', 'public', f));
  app.get('/p/:slug', page('post.html'));
  app.get('/u/:username', page('profile.html'));

  // Anything else that is not a file gets the friendly 404 page.
  app.use((req, res) => res.status(404).sendFile(path.join(__dirname, '..', 'public', '404.html')));

  app.use(errorHandler);
  return app;
}

module.exports = createApp;
