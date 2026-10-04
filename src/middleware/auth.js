const User = require('../models/User');
const { HttpError } = require('../utils/http');

// Loads req.user when a valid session exists. Never blocks the request.
async function loadUser(req, res, next) {
  req.user = null;
  const id = req.session && req.session.userId;
  if (id) {
    const user = await User.findById(id).select('-password');
    if (user) req.user = user;
    else delete req.session.userId; // account deleted while logged in
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return next(new HttpError(401, 'Please log in to continue'));
  next();
}

const isAdmin = (user) => !!user && user.role === 'admin';
const canModerate = (user, ownerId) =>
  !!user && (isAdmin(user) || String(user._id) === String(ownerId));

module.exports = { loadUser, requireAuth, isAdmin, canModerate };
