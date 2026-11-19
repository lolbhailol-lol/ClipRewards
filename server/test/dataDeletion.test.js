process.env.MONGODB_URI = '';
process.env.INSTAGRAM_APP_SECRET = 'test-ig-secret';

const crypto = require('crypto');
const request = require('supertest');
const mongoose = require('mongoose');
const { connectDb, disconnectDb } = require('../src/db');
const { createApp } = require('../src/app');
const User = require('../src/models/User');
const SocialAccount = require('../src/models/SocialAccount');

let app;
beforeAll(async () => {
  await connectDb({ inMemory: true });
  app = createApp();
});
afterAll(disconnectDb);
beforeEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
});

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function signed(payload, secret = 'test-ig-secret') {
  const body = b64url(JSON.stringify({ algorithm: 'HMAC-SHA256', issued_at: 1, ...payload }));
  const sig = b64url(crypto.createHmac('sha256', secret).update(body).digest());
  return `${sig}.${body}`;
}

async function connected(igId) {
  const user = await User.create({ email: `${igId}@x.in`, role: 'creator', onboarded: true, creator: { instagram: 'riya.edits' } });
  await SocialAccount.create({ userId: user._id, platform: 'instagram', externalId: igId, username: 'riya.edits', status: 'active' });
  return user;
}

test('data deletion request deletes the Instagram connection and returns a status link', async () => {
  const user = await connected('17841400000000001');
  const res = await request(app)
    .post('/api/social/instagram/data-deletion')
    .type('form')
    .send({ signed_request: signed({ user_id: '17841400000000001' }) })
    .expect(200);
  expect(res.body.url).toMatch(/\/data-deletion\?code=[a-f0-9]{16}$/);
  expect(await SocialAccount.countDocuments({})).toBe(0);
  expect((await User.findById(user._id)).creator.instagram).toBe('');

  const status = await request(app).get(`/api/data-deletion/${res.body.confirmation_code}`).expect(200);
  expect(status.body.status).toBe('completed');
});

test('deauthorize removes the connection; bad signatures are rejected', async () => {
  await connected('555');
  await request(app).post('/api/social/instagram/deauthorize').type('form').send({ signed_request: signed({ user_id: '555' }, 'wrong') }).expect(400);
  expect(await SocialAccount.countDocuments({})).toBe(1);
  await request(app).post('/api/social/instagram/deauthorize').type('form').send({ signed_request: signed({ user_id: '555' }) }).expect(200);
  expect(await SocialAccount.countDocuments({})).toBe(0);
  await request(app).get('/api/data-deletion/0000000000000000').expect(404);
});
