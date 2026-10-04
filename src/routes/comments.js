const express = require('express');
const Comment = require('../models/Comment');
const Post = require('../models/Post');
const { requireAuth, canModerate } = require('../middleware/auth');
const { bad, notFound, forbidden } = require('../utils/http');
const { plain } = require('../utils/text');

const router = express.Router();

// Edit: only the author. Delete: author or admin. (Create/list live under /api/posts/:id/comments)
router.put('/:id', requireAuth, async (req, res) => {
  const c = await Comment.findById(req.params.id);
  if (!c) throw notFound('Comment not found');
  if (String(c.author) !== String(req.user._id)) throw forbidden('You can only edit your own comments');
  const text = plain(req.body.text, 2000);
  if (!text) throw bad('Comment cannot be empty');
  c.text = text;
  c.edited = true;
  await c.save();
  res.json({ _id: c._id, text: c.text, edited: true, updatedAt: c.updatedAt });
});

router.delete('/:id', requireAuth, async (req, res) => {
  const c = await Comment.findById(req.params.id);
  if (!c) throw notFound('Comment not found');
  if (!canModerate(req.user, c.author)) throw forbidden('You can only delete your own comments');

  // Remove the comment and its whole reply subtree.
  const all = await Comment.find({ postId: c.postId }).select('_id parentCommentId');
  const doomed = new Set([String(c._id)]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const x of all) {
      if (x.parentCommentId && doomed.has(String(x.parentCommentId)) && !doomed.has(String(x._id))) {
        doomed.add(String(x._id));
        grew = true;
      }
    }
  }
  await Comment.deleteMany({ _id: { $in: [...doomed] } });
  await Post.updateOne({ _id: c.postId }, { $inc: { commentsCount: -doomed.size } });
  res.json({ message: 'Deleted', removed: doomed.size });
});

module.exports = router;
