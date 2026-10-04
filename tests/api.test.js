/**
 * Integration tests. They need a MongoDB:
 *   - set TEST_MONGO_URI to point at one, or
 *   - leave it unset and mongodb-memory-server will download/start a temporary one.
 */
const request = require('supertest');
const mongoose = require('mongoose');

let mongod;
let app;

beforeAll(async () => {
  let uri = process.env.TEST_MONGO_URI;
  if (!uri) {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    mongod = await MongoMemoryServer.create();
    uri = mongod.getUri();
  }
  process.env.MONGO_URI = uri;
  await mongoose.connect(uri, { dbName: 'blogsphere_test' });
  await mongoose.connection.dropDatabase();
  app = require('../src/app')();
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

const agent = () => request.agent(app);
const PW = 'Passw0rdOK';

async function signup(name, email = `${name}@example.com`) {
  const a = agent();
  const r = await a.post('/api/auth/register').send({ username: name, email, password: PW });
  expect(r.status).toBe(201);
  return a;
}

describe('auth', () => {
  test('register, me, logout, login', async () => {
    const a = await signup('alice');
    expect((await a.get('/api/auth/me')).body.username).toBe('alice');
    await a.post('/api/auth/logout').expect(200);
    expect((await a.get('/api/auth/me')).body).toBeNull();
    await a.post('/api/auth/login').send({ email: 'alice@example.com', password: PW }).expect(200);
    await a.get('/api/auth/me').expect(200);
  });

  test('validation and duplicates', async () => {
    await request(app).post('/api/auth/register').send({ username: 'x', email: 'bad', password: '1' }).expect(400);
    await request(app).post('/api/auth/register').send({ username: 'weakpw', email: 'w@example.com', password: 'abcdefgh' }).expect(400);
    await request(app).post('/api/auth/register').send({ username: 'ALICE', email: 'other@example.com', password: PW }).expect(409);
    await request(app).post('/api/auth/login').send({ email: 'alice@example.com', password: 'wrong' }).expect(401);
  });

  test('NoSQL operator injection is rejected', async () => {
    const r = await request(app).post('/api/auth/login').send({ email: { $gt: '' }, password: { $gt: '' } });
    expect(r.status).toBe(400);
  });

  test('admin email gets admin role', async () => {
    const a = await signup('boss', 'admin@example.com');
    expect((await a.get('/api/auth/me')).body.role).toBe('admin');
  });

  test('cross-site writes are blocked', async () => {
    await request(app).post('/api/auth/login').set('Origin', 'https://evil.example').send({}).expect(403);
  });
});

describe('posts', () => {
  let author, other, post;

  beforeAll(async () => {
    author = await signup('writer');
    other = await signup('reader');
  });

  test('requires login to create', async () => {
    await request(app).post('/api/posts').send({ title: 'Hello world', content: '<p>some body text here</p>' }).expect(401);
  });

  test('create sanitizes HTML and builds metadata', async () => {
    const r = await author.post('/api/posts').send({
      title: 'Hello World Post',
      content: '<p>Hello <b>world</b> body text</p><script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">x</a>',
      tags: 'Node.js, Web Dev, web dev'
    });
    expect(r.status).toBe(201);
    post = r.body;
    expect(post.slug).toBe('hello-world-post');
    expect(post.content).not.toMatch(/script|onerror|javascript:/i);
    expect(post.tags).toEqual(['nodejs', 'web-dev']);
    expect(post.readingTime).toBe(1);
  });

  test('slugs stay unique', async () => {
    const r = await author.post('/api/posts').send({ title: 'Hello World Post', content: '<p>another body for it</p>' });
    expect(r.body.slug).not.toBe(post.slug);
    expect(r.body.slug).toMatch(/^hello-world-post-/);
  });

  test('public list + read by slug, views counted once per session', async () => {
    const list = await request(app).get('/api/posts');
    expect(list.status).toBe(200);
    expect(list.body.total).toBeGreaterThanOrEqual(2);
    expect(list.body.items[0].content).toBeUndefined();

    const reader = agent();
    await reader.get(`/api/posts/${post.slug}`).expect(200);
    const again = await reader.get(`/api/posts/${post.slug}`);
    expect(again.body.views).toBe(1);
  });

  test('search and tag filter', async () => {
    expect((await request(app).get('/api/posts?q=hello')).body.total).toBeGreaterThanOrEqual(1);
    expect((await request(app).get('/api/posts?q=zzzznomatch')).body.total).toBe(0);
    expect((await request(app).get('/api/posts?tag=web-dev')).body.total).toBe(1);
    expect((await request(app).get('/api/posts?q=.*')).body.total).toBe(0); // regex is escaped
    const tags = await request(app).get('/api/posts/tags');
    expect(tags.body.map((t) => t.name)).toContain('nodejs');
  });

  test('pagination', async () => {
    const r = await request(app).get('/api/posts?limit=1&page=2');
    expect(r.body.items).toHaveLength(1);
    expect(r.body.pages).toBeGreaterThanOrEqual(2);
  });

  test('only the owner can edit/delete; admin can delete', async () => {
    await other.put(`/api/posts/${post._id}`).send({ title: 'Hacked title', content: '<p>hacked content here</p>' }).expect(403);
    await other.delete(`/api/posts/${post._id}`).expect(403);
    const ok = await author.put(`/api/posts/${post._id}`).send({ title: 'Renamed Post', content: '<p>updated body text</p>' });
    expect(ok.status).toBe(200);
    expect(ok.body.slug).toBe('renamed-post');
  });

  test('drafts are private', async () => {
    const d = await author.post('/api/posts').send({ title: 'Secret draft', content: '<p>not ready yet ok</p>', status: 'draft' });
    expect(d.body.status).toBe('draft');
    await request(app).get(`/api/posts/${d.body.slug}`).expect(404);
    await other.get(`/api/posts/${d.body.slug}`).expect(404);
    await author.get(`/api/posts/${d.body.slug}`).expect(200);
    const list = await request(app).get('/api/posts?q=secret');
    expect(list.body.total).toBe(0);
    const mine = await author.get('/api/posts/mine?status=draft');
    expect(mine.body.total).toBe(1);
    expect(mine.body.stats.drafts).toBe(1);
    await other.post(`/api/posts/${d.body._id}/like`).expect(404);
  });

  test('like and bookmark toggle', async () => {
    let r = await other.post(`/api/posts/${post._id}/like`);
    expect(r.body).toEqual({ liked: true, likesCount: 1 });
    r = await other.post(`/api/posts/${post._id}/like`);
    expect(r.body).toEqual({ liked: false, likesCount: 0 });

    expect((await other.post(`/api/posts/${post._id}/bookmark`)).body.bookmarked).toBe(true);
    const bm = await other.get('/api/posts/bookmarks');
    expect(bm.body.total).toBe(1);
    expect(bm.body.items[0].bookmarked).toBe(true);
    expect((await other.post(`/api/posts/${post._id}/bookmark`)).body.bookmarked).toBe(false);
    await request(app).post(`/api/posts/${post._id}/like`).expect(401);
  });

  test('comments: nested, edit own only, cascade delete, counts', async () => {
    const pid = post._id;
    const c1 = (await other.post(`/api/posts/${pid}/comments`).send({ text: 'Nice <b>one</b>' })).body;
    expect(c1.text).toBe('Nice one');
    const c2 = (await author.post(`/api/posts/${pid}/comments`).send({ text: 'Thanks!', parentCommentId: c1._id })).body;
    await author.post(`/api/posts/${pid}/comments`).send({ text: 'x', parentCommentId: '507f1f77bcf86cd799439011' }).expect(400);
    await author.post(`/api/posts/${pid}/comments`).send({ text: '   ' }).expect(400);

    const list = await author.get(`/api/posts/${pid}/comments`);
    expect(list.body).toHaveLength(2);
    expect(list.body.find((c) => c._id === c2._id).canEdit).toBe(true);
    expect(list.body.find((c) => c._id === c1._id).canEdit).toBe(false);

    await author.put(`/api/comments/${c1._id}`).send({ text: 'hijack' }).expect(403);
    const ed = await other.put(`/api/comments/${c1._id}`).send({ text: 'Edited' });
    expect(ed.body.edited).toBe(true);

    expect((await request(app).get(`/api/posts/${pid}`)).body.commentsCount).toBe(2);

    await author.delete(`/api/comments/${c1._id}`).expect(403); // post owner is not a moderator
    const del = await other.delete(`/api/comments/${c1._id}`).expect(200);
    expect(del.body.removed).toBe(2); // reply removed with its parent
    expect((await request(app).get(`/api/posts/${pid}`)).body.commentsCount).toBe(0);
  });

  test('admin can moderate any post', async () => {
    const admin = agent();
    await admin.post('/api/auth/login').send({ email: 'admin@example.com', password: PW }).expect(200);
    const p = (await author.post('/api/posts').send({ title: 'To be moderated', content: '<p>content content content</p>' })).body;
    await admin.delete(`/api/posts/${p._id}`).expect(200);
    await request(app).get(`/api/posts/${p.slug}`).expect(404);
  });
});

describe('users & account', () => {
  test('public profile with stats; update own profile', async () => {
    const a = await signup('profiler');
    await a.post('/api/posts').send({ title: 'Profile post', content: '<p>some profile content</p>' });
    const upd = await a.put('/api/users/me').send({ bio: 'I <i>write</i>', avatar: 'javascript:alert(1)' });
    expect(upd.status).toBe(400);
    const ok = await a.put('/api/users/me').send({ bio: 'I <i>write</i>' });
    expect(ok.body.bio).toBe('I write');
    const pub = await request(app).get('/api/users/PROFILER');
    expect(pub.body.stats.posts).toBe(1);
    expect(pub.body.email).toBeUndefined();
    expect(pub.body.password).toBeUndefined();
    await request(app).get('/api/users/nobody').expect(404);
  });

  test('change password and delete account', async () => {
    const a = await signup('leaver');
    await a.put('/api/auth/password').send({ currentPassword: 'nope', newPassword: 'Another1pass' }).expect(401);
    await a.put('/api/auth/password').send({ currentPassword: PW, newPassword: 'Another1pass' }).expect(200);
    await a.delete('/api/auth/account').send({ password: PW }).expect(401);
    await a.delete('/api/auth/account').send({ password: 'Another1pass' }).expect(200);
    expect((await a.get('/api/auth/me')).body).toBeNull();
    await request(app).post('/api/auth/login').send({ email: 'leaver@example.com', password: 'Another1pass' }).expect(401);
  });
});

describe('uploads', () => {
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

  test('requires login', async () => {
    await request(app).post('/api/upload').attach('image', PNG, 'a.png').expect(401);
  });

  test('accepts a real image, rejects disguised files', async () => {
    const a = await signup('uploader');
    const ok = await a.post('/api/upload').attach('image', PNG, { filename: 'a.png', contentType: 'image/png' });
    expect(ok.status).toBe(201);
    expect(ok.body.url).toMatch(/^\/uploads\/[a-f0-9]{24}\.png$/);
    await request(app).get(ok.body.url).expect(200);

    const fake = await a.post('/api/upload').attach('image', Buffer.from('<script>alert(1)</script>'), { filename: 'a.png', contentType: 'image/png' });
    expect(fake.status).toBe(400);
    const html = await a.post('/api/upload').attach('image', Buffer.from('<html>'), { filename: 'a.html', contentType: 'text/html' });
    expect(html.status).toBe(400);
  });
});

test('health and unknown api route', async () => {
  await request(app).get('/api/health').expect(200);
  await request(app).get('/api/nope').expect(404);
});
