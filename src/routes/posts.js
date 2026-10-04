const express = require('express');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const User = require('../models/User');
const { requireAuth, canModerate } = require('../middleware/auth');
const { bad, notFound, forbidden, paging, pageOf, isObjectId } = require('../utils/http');
const {
  cleanHtml, toText, plain, excerptOf, readingTime, makeSlug, suffix, escapeRegex
} = require('../utils/text');

const router = express.Router();
const AUTHOR_FIELDS = 'username avatar bio';

// ---------- helpers ----------

const str = (v) => (typeof v === 'string' ? v : '');

function cleanTags(input) {
  const arr = Array.isArray(input) ? input : String(input || '').split(',');
  const out = [];
  for (const t of arr) {
    const tag = plain(t, 24).toLowerCase().replace(/[^a-z0-9\-+# ]/g, '').trim().replace(/\s+/g, '-');
    if (tag && !out.includes(tag)) out.push(tag);
  }
  return out.slice(0, 5);
}

function cleanImageUrl(v) {
  const s = str(v).trim();
  if (!s) return '';
  if (/^\/uploads\/[\w.\-]+$/.test(s) || /^https?:\/\/[^\s"'<>]+$/i.test(s)) return s.slice(0, 500);
  throw bad('Cover image must be an uploaded image or an http(s) URL');
}

function dto(post, viewer, bookmarkSet, { withContent = false } = {}) {
  const p = post.toObject ? post.toObject() : post;
  const vid = viewer ? String(viewer._id) : null;
  const out = {
    _id: p._id,
    title: p.title,
    slug: p.slug,
    excerpt: p.excerpt,
    coverImage: p.coverImage,
    tags: p.tags,
    category: p.category || 'General',
    featured: !!p.featured,
    status: p.status,
    author: p.author,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    publishedAt: p.publishedAt,
    likesCount: p.likesCount,
    commentsCount: p.commentsCount,
    views: p.views,
    readingTime: p.readingTime,
    liked: !!vid && (p.likes || []).some((id) => String(id) === vid),
    bookmarked: !!bookmarkSet && bookmarkSet.has(String(p._id))
  };
  if (withContent) out.content = p.content;
  return out;
}

const bookmarkSetOf = (viewer) => new Set(((viewer && viewer.bookmarks) || []).map(String));

async function uniqueSlug(title, ignoreId) {
  const base = makeSlug(title);
  let slug = base;
  while (await Post.exists({ slug, ...(ignoreId ? { _id: { $ne: ignoreId } } : {}) })) {
    slug = `${base}-${suffix()}`;
  }
  return slug;
}

function bodyFeatured(body) { return body && body.featured === true; }

function cleanCategory(v) {
  const value = plain(v || 'General', 40).trim();
  return value || 'General';
}

function buildFields(body) {
  const title = plain(body.title, 150);
  if (title.length < 3) throw bad('Title must be at least 3 characters');
  const content = cleanHtml(body.content);
  if (toText(content).length < 10 && !/<img/i.test(content)) throw bad('Post content is too short');
  const status = body.status === 'draft' ? 'draft' : 'published';
  return {
    title,
    content,
    status,
    excerpt: excerptOf(content),
    readingTime: readingTime(content),
    tags: cleanTags(body.tags),
    category: cleanCategory(body.category),
    coverImage: cleanImageUrl(body.coverImage)
  };
}

async function findPost(idOrSlug) {
  return isObjectId(idOrSlug)
    ? Post.findById(idOrSlug).populate('author', AUTHOR_FIELDS)
    : Post.findOne({ slug: String(idOrSlug) }).populate('author', AUTHOR_FIELDS);
}

const isOwnerOrAdmin = (post, user) => canModerate(user, post.author._id || post.author);

// ---------- list / discovery ----------

// GET /api/posts?page=&limit=&q=&tag=&author=&sort=latest|popular|discussed
router.get('/', async (req, res) => {
  const pg = paging(req.query, 9, 30);
  const filter = { status: 'published' };

  const q = str(req.query.q).trim().slice(0, 80);
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ title: rx }, { excerpt: rx }, { tags: rx }];
  }
  const tag = str(req.query.tag).trim().toLowerCase();
  if (tag) filter.tags = tag;
  const category = str(req.query.category).trim().slice(0, 40);
  if (category) filter.category = category;

  const authorName = str(req.query.author).trim();
  if (authorName) {
    const a = await User.findOne({ username: new RegExp(`^${escapeRegex(authorName)}$`, 'i') }).select('_id');
    if (!a) return res.json(pageOf([], 0, pg));
    filter.author = a._id;
  }

  const sorts = {
    latest: { publishedAt: -1, _id: -1 },
    popular: { likesCount: -1, views: -1, _id: -1 },
    discussed: { commentsCount: -1, _id: -1 }
  };
  const sort = sorts[req.query.sort] || sorts.latest;

  const [rows, total] = await Promise.all([
    Post.find(filter).sort(sort).skip(pg.skip).limit(pg.limit).populate('author', AUTHOR_FIELDS),
    Post.countDocuments(filter)
  ]);
  const bm = bookmarkSetOf(req.user);
  res.json(pageOf(rows.map((p) => dto(p, req.user, bm)), total, pg));
});

// Curated discovery endpoints for a richer home page.
router.get('/featured', async (req, res) => {
  const rows = await Post.find({ status: 'published', featured: true })
    .sort({ publishedAt: -1 }).limit(6).populate('author', AUTHOR_FIELDS);
  const bm = bookmarkSetOf(req.user);
  res.json(rows.map((p) => dto(p, req.user, bm)));
});

router.get('/trending', async (req, res) => {
  const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30);
  const rows = await Post.find({ status: 'published', publishedAt: { $gte: since } })
    .sort({ likesCount: -1, commentsCount: -1, views: -1 }).limit(6).populate('author', AUTHOR_FIELDS);
  const bm = bookmarkSetOf(req.user);
  res.json(rows.map((p) => dto(p, req.user, bm)));
});

router.get('/categories', async (req, res) => {
  const rows = await Post.aggregate([
    { $match: { status: 'published' } },
    { $group: { _id: { $ifNull: ['$category', 'General'] }, count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
    { $limit: 16 }
  ]);
  res.json(rows.map((x) => ({ name: x._id, count: x.count })));
});

// GET /api/posts/tags - most used tags among published posts
router.get('/tags', async (req, res) => {
  const posts = await Post.find({ status: 'published', 'tags.0': { $exists: true } }).select('tags');
  const counts = {};
  for (const p of posts) for (const t of p.tags) counts[t] = (counts[t] || 0) + 1;
  const tags = Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 20);
  res.json(tags);
});

// GET /api/posts/mine?status=draft|published|all
router.get('/mine', requireAuth, async (req, res) => {
  const pg = paging(req.query, 12, 50);
  const filter = { author: req.user._id };
  if (['draft', 'published'].includes(req.query.status)) filter.status = req.query.status;

  const [rows, total, all] = await Promise.all([
    Post.find(filter).sort({ updatedAt: -1 }).skip(pg.skip).limit(pg.limit).populate('author', AUTHOR_FIELDS),
    Post.countDocuments(filter),
    Post.find({ author: req.user._id }).select('status views likesCount commentsCount')
  ]);
  const stats = all.reduce(
    (s, p) => {
      s[p.status === 'draft' ? 'drafts' : 'published']++;
      s.views += p.views;
      s.likes += p.likesCount;
      s.comments += p.commentsCount;
      return s;
    },
    { published: 0, drafts: 0, views: 0, likes: 0, comments: 0 }
  );
  const bm = bookmarkSetOf(req.user);
  res.json({ ...pageOf(rows.map((p) => dto(p, req.user, bm)), total, pg), stats });
});

// GET /api/posts/bookmarks
router.get('/bookmarks', requireAuth, async (req, res) => {
  const pg = paging(req.query, 12, 50);
  const ids = req.user.bookmarks || [];
  const filter = { _id: { $in: ids }, status: 'published' };
  const [rows, total] = await Promise.all([
    Post.find(filter).sort({ publishedAt: -1 }).skip(pg.skip).limit(pg.limit).populate('author', AUTHOR_FIELDS),
    Post.countDocuments(filter)
  ]);
  const bm = bookmarkSetOf(req.user);
  res.json(pageOf(rows.map((p) => dto(p, req.user, bm)), total, pg));
});

// ---------- single post ----------

router.get('/:idOrSlug', async (req, res) => {
  const post = await findPost(req.params.idOrSlug);
  if (!post) throw notFound('Post not found');
  const mine = req.user && isOwnerOrAdmin(post, req.user);
  if (post.status === 'draft' && !mine) throw notFound('Post not found');

  // Count a view once per session, and never for the author.
  const own = req.user && String(post.author._id) === String(req.user._id);
  const seen = (req.session.viewed = req.session.viewed || []);
  if (post.status === 'published' && !own && !seen.includes(String(post._id))) {
    seen.push(String(post._id));
    if (seen.length > 100) seen.shift();
    post.views += 1;
    await Post.updateOne({ _id: post._id }, { $inc: { views: 1 } });
  }
  res.json(dto(post, req.user, bookmarkSetOf(req.user), { withContent: true }));
});

// ---------- write ----------

router.post('/', requireAuth, async (req, res) => {
  const fields = buildFields(req.body);
  const post = await Post.create({
    ...fields,
    slug: await uniqueSlug(fields.title),
    author: req.user._id,
    featured: req.user.role === 'admin' && bodyFeatured(req.body),
    publishedAt: fields.status === 'published' ? new Date() : null
  });
  await post.populate('author', AUTHOR_FIELDS);
  res.status(201).json(dto(post, req.user, bookmarkSetOf(req.user), { withContent: true }));
});

router.put('/:id', requireAuth, async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) throw notFound('Post not found');
  if (!isOwnerOrAdmin(post, req.user)) throw forbidden('You can only edit your own posts');

  const fields = buildFields(req.body);
  if (fields.title !== post.title) post.slug = await uniqueSlug(fields.title, post._id);
  if (post.status === 'draft' && fields.status === 'published') post.publishedAt = new Date();
  if (fields.status === 'draft') post.publishedAt = null;
  Object.assign(post, fields);
  if (req.user.role === 'admin' && req.body.featured !== undefined) post.featured = req.body.featured === true;
  await post.save();
  await post.populate('author', AUTHOR_FIELDS);
  res.json(dto(post, req.user, bookmarkSetOf(req.user), { withContent: true }));
});

router.delete('/:id', requireAuth, async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) throw notFound('Post not found');
  if (!isOwnerOrAdmin(post, req.user)) throw forbidden('You can only delete your own posts');
  await Comment.deleteMany({ postId: post._id });
  await User.updateMany({ bookmarks: post._id }, { $pull: { bookmarks: post._id } });
  await post.deleteOne();
  res.json({ message: 'Post deleted' });
});

// ---------- engagement ----------

router.post('/:id/like', requireAuth, async (req, res) => {
  const post = await Post.findOne({ _id: req.params.id, status: 'published' });
  if (!post) throw notFound('Post not found');
  const uid = req.user._id;
  const already = post.likes.some((id) => String(id) === String(uid));
  const updated = await Post.findOneAndUpdate(
    already ? { _id: post._id, likes: uid } : { _id: post._id, likes: { $ne: uid } },
    already ? { $pull: { likes: uid }, $inc: { likesCount: -1 } } : { $addToSet: { likes: uid }, $inc: { likesCount: 1 } },
    { returnDocument: 'after' }
  );
  const final = updated || post;
  res.json({ liked: !already, likesCount: final.likesCount });
});

router.post('/:id/bookmark', requireAuth, async (req, res) => {
  const post = await Post.findOne({ _id: req.params.id, status: 'published' }).select('_id');
  if (!post) throw notFound('Post not found');
  const has = (req.user.bookmarks || []).some((id) => String(id) === String(post._id));
  await User.updateOne(
    { _id: req.user._id },
    has ? { $pull: { bookmarks: post._id } } : { $addToSet: { bookmarks: post._id } }
  );
  res.json({ bookmarked: !has });
});

// ---------- comments on a post ----------

router.get('/:id/comments', async (req, res) => {
  if (!isObjectId(req.params.id)) throw notFound('Post not found');
  const post = await Post.findById(req.params.id).select('status author');
  if (!post || (post.status === 'draft' && !isOwnerOrAdmin(post, req.user))) throw notFound('Post not found');
  const comments = await Comment.find({ postId: post._id })
    .sort({ createdAt: 1 })
    .populate('author', 'username avatar');
  res.json(
    comments.map((c) => ({
      _id: c._id,
      text: c.text,
      author: c.author || { username: 'deleted user' },
      parentCommentId: c.parentCommentId,
      edited: c.edited,
      createdAt: c.createdAt,
      canEdit: !!req.user && c.author && String(c.author._id) === String(req.user._id),
      canDelete: !!req.user && canModerate(req.user, c.author && c.author._id)
    }))
  );
});

router.post('/:id/comments', requireAuth, async (req, res) => {
  const post = await Post.findOne({ _id: req.params.id, status: 'published' }).select('_id');
  if (!post) throw notFound('Post not found');
  const text = plain(req.body.text, 2000);
  if (!text) throw bad('Comment cannot be empty');

  let parent = null;
  if (req.body.parentCommentId) {
    if (!isObjectId(req.body.parentCommentId)) throw bad('Invalid parent comment');
    parent = await Comment.findOne({ _id: req.body.parentCommentId, postId: post._id });
    if (!parent) throw bad('Parent comment not found on this post');
  }

  const c = await Comment.create({
    text,
    postId: post._id,
    author: req.user._id,
    parentCommentId: parent ? parent._id : null
  });
  await Post.updateOne({ _id: post._id }, { $inc: { commentsCount: 1 } });
  res.status(201).json({
    _id: c._id,
    text: c.text,
    author: { _id: req.user._id, username: req.user.username, avatar: req.user.avatar },
    parentCommentId: c.parentCommentId,
    edited: false,
    createdAt: c.createdAt,
    canEdit: true,
    canDelete: true
  });
});

module.exports = router;
