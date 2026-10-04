require('dotenv').config({ quiet: true });
const path = require('path');

const env = process.env.NODE_ENV || 'development';
const isProd = env === 'production';

if (isProd && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET must be set in production');
}

const list = (v) =>
  (v || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

module.exports = {
  env,
  isProd,
  isTest: env === 'test',
  port: Number(process.env.PORT) || 5000,
  // 'mongo' keeps sessions in MongoDB (survives restarts). 'memory' is for quick local trials only.
  sessionStore: process.env.SESSION_STORE || 'mongo',
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/blogsphere',
  sessionSecret: process.env.SESSION_SECRET || 'dev-only-secret-change-me',
  // Set COOKIE_SECURE=false if you run production over plain HTTP (not recommended)
  cookieSecure: isProd && process.env.COOKIE_SECURE !== 'false',
  uploadDir: path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads')),
  maxUploadMB: Number(process.env.MAX_UPLOAD_MB) || 5,
  // Emails listed here get the "admin" role (can moderate any post/comment)
  adminEmails: list(process.env.ADMIN_EMAILS),
  appName: 'BlogSphere'
};
