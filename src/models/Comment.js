const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, maxlength: 2000 },
    postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    parentCommentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null },
    edited: { type: Boolean, default: false }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Comment', CommentSchema);
