/* Upgrades data created by the original BlogSphere (v1) so it works with v2:  npm run migrate
 * Safe to run more than once. It only touches posts that are missing the new fields.
 *  - adds slug, excerpt, reading time, status=published, publishedAt
 *  - sanitizes old HTML content
 *  - fills comment counts
 * Existing users, passwords and comments keep working as they are. */
const mongoose = require('mongoose');
const config = require('../src/config');
const Post = require('../src/models/Post');
const Comment = require('../src/models/Comment');
const { cleanHtml, excerptOf, readingTime, makeSlug, suffix } = require('../src/utils/text');

(async () => {
  await mongoose.connect(config.mongoUri);
  const col = Post.collection;
  const old = await col.find({ $or: [{ slug: { $exists: false } }, { status: { $exists: false } }] }).toArray();
  let n = 0;
  for (const p of old) {
    const content = cleanHtml(p.content);
    let slug = makeSlug(p.title || 'post');
    while (await col.findOne({ slug, _id: { $ne: p._id } })) slug = `${makeSlug(p.title || 'post')}-${suffix()}`;
    await col.updateOne(
      { _id: p._id },
      {
        $set: {
          slug,
          content,
          excerpt: excerptOf(content),
          readingTime: readingTime(content),
          status: 'published',
          publishedAt: p.createdAt || new Date(),
          coverImage: p.coverImage || '',
          tags: p.tags || [],
          likes: p.likes || [],
          likesCount: p.likesCount || 0,
          views: p.views || 0,
          commentsCount: await Comment.countDocuments({ postId: p._id })
        }
      }
    );
    n++;
  }
  console.log(`Migrated ${n} post(s).`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
