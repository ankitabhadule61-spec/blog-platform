const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const config = require('../config');
const { requireAuth } = require('../middleware/auth');
const { bad, HttpError } = require('../utils/http');
const { escapeRegex } = require('../utils/text');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.isTest ? 1000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts, please try again in a few minutes' }
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;

function checkPassword(pw) {
  if (typeof pw !== 'string' || pw.length < 8) throw bad('Password must be at least 8 characters');
  if (pw.length > 128) throw bad('Password is too long');
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) throw bad('Password must contain a letter and a number');
}

const me = (u) => ({
  userId: u._id,
  username: u.username,
  email: u.email,
  role: u.role,
  bio: u.bio,
  avatar: u.avatar,
  createdAt: u.createdAt
});

// Regenerate the session on login/registration to prevent session fixation.
const startSession = (req, user) =>
  new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.userId = String(user._id);
      req.session.save((e) => (e ? reject(e) : resolve()));
    });
  });

router.post('/register', authLimiter, async (req, res) => {
  const username = String(req.body.username || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = req.body.password;

  if (!USERNAME_RE.test(username)) throw bad('Username must be 3-30 characters: letters, numbers or underscore');
  if (!EMAIL_RE.test(email)) throw bad('A valid email is required');
  checkPassword(password);

  if (await User.findOne({ email })) throw new HttpError(409, 'Email already registered');
  if (await User.findOne({ username: new RegExp(`^${escapeRegex(username)}$`, 'i') }))
    throw new HttpError(409, 'Username already taken');

  const user = await User.create({
    username,
    email,
    password: await bcrypt.hash(password, 12),
    role: config.adminEmails.includes(email) ? 'admin' : 'user'
  });

  await startSession(req, user);
  res.status(201).json({ message: 'Account created', ...me(user) });
});

router.post('/login', authLimiter, async (req, res) => {
  if (typeof req.body.email !== 'string' || typeof req.body.password !== 'string' || !req.body.email || !req.body.password)
    throw bad('Email and password are required');
  const email = req.body.email.trim().toLowerCase();
  const password = req.body.password;

  const user = await User.findOne({ email });
  // Same response for unknown email and wrong password (no account enumeration).
  const ok = user && (await bcrypt.compare(password, user.password));
  if (!ok) throw new HttpError(401, 'Invalid email or password');

  if (config.adminEmails.includes(user.email) && user.role !== 'admin') {
    user.role = 'admin';
    await user.save();
  }

  await startSession(req, user);
  res.json({ message: 'Login successful', ...me(user) });
});

router.post('/logout', (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out' });
  });
});

// Returns null (not 401) for visitors so the browser console stays clean.
router.get('/me', (req, res) => res.json(req.user ? me(req.user) : null));

router.put('/password', requireAuth, authLimiter, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id);
  if (!(await bcrypt.compare(String(currentPassword || ''), user.password)))
    throw new HttpError(401, 'Current password is incorrect');
  checkPassword(newPassword);
  user.password = await bcrypt.hash(newPassword, 12);
  await user.save();
  res.json({ message: 'Password updated' });
});

router.delete('/account', requireAuth, authLimiter, async (req, res, next) => {
  const user = await User.findById(req.user._id);
  if (!(await bcrypt.compare(String(req.body.password || ''), user.password)))
    throw new HttpError(401, 'Password is incorrect');

  const posts = await Post.find({ author: user._id }).select('_id');
  const ids = posts.map((p) => p._id);
  await Comment.deleteMany({ $or: [{ author: user._id }, { postId: { $in: ids } }] });
  await Post.deleteMany({ author: user._id });
  await Post.updateMany({ likes: user._id }, { $pull: { likes: user._id }, $inc: { likesCount: -1 } });
  await User.deleteOne({ _id: user._id });

  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('connect.sid');
    res.json({ message: 'Account deleted' });
  });
});

module.exports = router;
module.exports.me = me;
