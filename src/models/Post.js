const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    slug: { type: String, required: true, unique: true },
    content: { type: String, required: true },
    excerpt: { type: String, default: '' },
    coverImage: { type: String, default: '' },
    tags: [{ type: String, lowercase: true, trim: true }],
    category: { type: String, default: 'General', trim: true, maxlength: 40, index: true },
    status: { type: String, enum: ['draft', 'published'], default: 'published', index: true },
    featured: { type: Boolean, default: false, index: true },
    publishedAt: { type: Date, default: null },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    likesCount: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    readingTime: { type: Number, default: 1 }
  },
  { timestamps: true }
);

PostSchema.index({ status: 1, publishedAt: -1 });
PostSchema.index({ tags: 1, status: 1 });
PostSchema.index({ category: 1, status: 1, publishedAt: -1 });
PostSchema.index({ title: 'text', excerpt: 'text', tags: 'text' });

module.exports = mongoose.model('Post', PostSchema);
