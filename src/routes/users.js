const express = require('express');
const User = require('../models/User');
const Post = require('../models/Post');
const { requireAuth } = require('../middleware/auth');
const { bad, notFound } = require('../utils/http');
const { plain, escapeRegex } = require('../utils/text');

const router = express.Router();

// PUT /api/users/me - update own profile
router.put('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.user._id);

  if (req.body.bio !== undefined) user.bio = plain(req.body.bio, 300);

  if (req.body.avatar !== undefined) {
    const a = String(req.body.avatar).trim();
    if (a && !/^\/uploads\/[\w.\-]+$/.test(a) && !/^https?:\/\/[^\s"'<>]+$/i.test(a))
      throw bad('Avatar must be an uploaded image or an http(s) URL');
    user.avatar = a.slice(0, 500);
  }

  if (req.body.username !== undefined && req.body.username !== user.username) {
    const username = String(req.body.username).trim();
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) throw bad('Username must be 3-30 characters: letters, numbers or underscore');
    const taken = await User.findOne({
      username: new RegExp(`^${escapeRegex(username)}$`, 'i'),
      _id: { $ne: user._id }
    });
    if (taken) return res.status(409).json({ message: 'Username already taken' });
    user.username = username;
  }

  await user.save();
  res.json({ userId: user._id, username: user.username, bio: user.bio, avatar: user.avatar });
});

// Follow / unfollow a writer.
router.post('/:username/follow', requireAuth, async (req, res) => {
  const target = await User.findOne({ username: new RegExp(`^${escapeRegex(String(req.params.username))}$`, 'i') });
  if (!target) throw notFound('User not found');
  if (String(target._id) === String(req.user._id)) throw bad('You cannot follow yourself');
  const me = await User.findById(req.user._id).select('following followingCount');
  const has = (me.following || []).some((id) => String(id) === String(target._id));
  if (has) {
    me.following.pull(target._id);
    me.followingCount = Math.max(0, (me.followingCount || 0) - 1);
    target.followersCount = Math.max(0, (target.followersCount || 0) - 1);
  } else {
    me.following.addToSet(target._id);
    me.followingCount = (me.followingCount || 0) + 1;
    target.followersCount = (target.followersCount || 0) + 1;
  }
  await Promise.all([me.save(), target.save()]);
  res.json({ following: !has, followers: target.followersCount });
});

// GET /api/users/:username - public profile
router.get('/:username', async (req, res) => {
  const user = await User.findOne({
    username: new RegExp(`^${escapeRegex(String(req.params.username))}$`, 'i')
  }).select('username bio avatar createdAt');
  if (!user) throw notFound('User not found');

  const posts = await Post.find({ author: user._id, status: 'published' }).select('likesCount views');
  const viewer = req.user;
  const following = !!viewer && (viewer.following || []).some((id) => String(id) === String(user._id));
  const followers = await User.countDocuments({ following: user._id });
  res.json({
    _id: user._id,
    username: user.username,
    bio: user.bio,
    avatar: user.avatar,
    createdAt: user.createdAt,
    stats: {
      posts: posts.length,
      likes: posts.reduce((n, p) => n + p.likesCount, 0),
      views: posts.reduce((n, p) => n + p.views, 0),
      followers,
      following: user.followingCount || 0,
      isFollowing: following
    }
  });
});

module.exports = router;
