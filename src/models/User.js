const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 30 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    bio: { type: String, default: '', maxlength: 300 },
    avatar: { type: String, default: '' },
    bookmarks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    followersCount: { type: Number, default: 0 },
    followingCount: { type: Number, default: 0 }
  },
  { timestamps: true }
);

UserSchema.index({ username: 'text', bio: 'text' });

module.exports = mongoose.model('User', UserSchema);
