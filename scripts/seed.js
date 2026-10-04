/* Fills the database with demo writers and posts:  npm run seed
 * Demo login for every account:  password  Demo1234  */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const config = require('../src/config');
const User = require('../src/models/User');
const Post = require('../src/models/Post');
const Comment = require('../src/models/Comment');
const { excerptOf, readingTime, makeSlug } = require('../src/utils/text');

const WRITERS = [
  { username: 'maya_codes', email: 'maya@demo.dev', bio: 'Frontend engineer. Writes about CSS, accessibility and small tools.' },
  { username: 'dev_arjun', email: 'arjun@demo.dev', bio: 'Backend developer who likes databases more than is healthy.' },
  { username: 'nora_travels', email: 'nora@demo.dev', bio: 'Slow travel, street food and notebooks full of maps.' }
];

const POSTS = [
  ['Why your first Express API deserves a proper error handler', 1, ['nodejs', 'backend'],
    '<p>Most tutorials end at <code>res.json()</code>. Real apps start there. A central error handler turns every failure into the same predictable shape, so the frontend never has to guess.</p><h2>One place for every failure</h2><p>Validation problems, missing records and duplicate keys all map to a status code and a message a person can act on.</p><blockquote>If an error message does not tell the reader what to do next, it is not finished.</blockquote><p>Start small: a not-found route, a handler with four arguments, and tests that prove both work.</p>'],
  ['A calmer way to think about CSS layout', 0, ['css', 'frontend'],
    '<p>Grid for the page, flexbox for the row, and a few custom properties for everything that repeats. That is the whole trick.</p><h2>Start from the content</h2><p>Write the markup as if there were no styles. If it reads well, the layout only has to stay out of the way.</p><p>Then add a type scale, a spacing scale, and one accent colour. Resist the urge to add a second.</p>'],
  ['Three days in Lisbon with no plan', 2, ['travel'],
    '<p>We arrived on a Tuesday with one rule: follow the smell of bread. It led us up four hills, into a tiny bakery, and eventually to a rooftop where a stranger poured us coffee.</p><h2>What we would do again</h2><p>Ride tram 28 before 8am, eat lunch at the counter, and leave the afternoon empty.</p>'],
  ['Indexes: the boring performance win', 1, ['mongodb', 'backend', 'nodejs'],
    '<p>Before caching, before rewrites, check your indexes. A query that scans ten thousand documents to return ten is a problem a single line can fix.</p><pre class="ql-syntax" spellcheck="false">PostSchema.index({ status: 1, publishedAt: -1 });</pre><p>Use <code>explain()</code> and let the numbers decide.</p>'],
  ['Accessible by default: five habits that cost nothing', 0, ['accessibility', 'frontend', 'css'],
    '<p>Accessibility is mostly habit. Use real buttons. Label every input. Keep focus visible. Check contrast once, at design time. Test with the keyboard before you ship.</p><p>None of these slow you down, and all of them help people who never mention they need them.</p>'],
  ['The case for writing drafts you never publish', 2, ['writing'],
    '<p>Half of what I write never leaves my drafts folder. That is not waste. It is how I find out what I think.</p><p>Publish the ones that survive a week of rereading.</p>']
];

(async () => {
  await mongoose.connect(config.mongoUri);
  const hash = await bcrypt.hash('Demo1234', 12);
  const users = [];
  for (const w of WRITERS) {
    users.push((await User.findOne({ email: w.email })) || (await User.create({ ...w, password: hash })));
  }
  let made = 0;
  for (const [i, [title, w, tags, content]] of POSTS.entries()) {
    const slug = makeSlug(title);
    if (await Post.exists({ slug })) continue;
    const when = new Date(Date.now() - (POSTS.length - i) * 86400000 * 2);
    await Post.create({
      title, slug, content, tags, excerpt: excerptOf(content), readingTime: readingTime(content),
      author: users[w]._id, status: 'published', publishedAt: when, createdAt: when,
      views: 20 + i * 13, likesCount: 0
    });
    made++;
  }
  const first = await Post.findOne({ slug: makeSlug(POSTS[0][0]) });
  if (first && !(await Comment.exists({ postId: first._id }))) {
    const c = await Comment.create({ text: 'Exactly this. Our API returned three different error shapes until we fixed it.', postId: first._id, author: users[0]._id });
    await Comment.create({ text: 'Same here – one handler saved us a lot of frontend special cases.', postId: first._id, author: users[1]._id, parentCommentId: c._id });
    await Post.updateOne({ _id: first._id }, { commentsCount: 2 });
  }
  console.log(`Seeded ${made} posts. Demo logins: maya@demo.dev / arjun@demo.dev / nora@demo.dev, password Demo1234`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
