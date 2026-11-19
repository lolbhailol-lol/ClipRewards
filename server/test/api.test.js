process.env.ADMIN_EMAILS = 'admin@test.local';
process.env.MONGODB_URI = '';

const request = require('supertest');
const mongoose = require('mongoose');
const { connectDb, disconnectDb } = require('../src/db');
const { createApp } = require('../src/app');

let app;

beforeAll(async () => {
  await connectDb({ inMemory: true });
  app = createApp();
});

afterAll(disconnectDb);

beforeEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
});

async function signIn(email) {
  const { body } = await request(app).post('/api/auth/otp/request').send({ email }).expect(200);
  const res = await request(app).post('/api/auth/otp/verify').send({ email, code: body.devCode }).expect(200);
  return { token: res.body.token, user: res.body.user, auth: { Authorization: `Bearer ${res.body.token}` } };
}

describe('auth', () => {
  test('email OTP signs in and creates a user with no role', async () => {
    const { user } = await signIn('New@Example.com');
    expect(user.email).toBe('new@example.com');
    expect(user.role).toBeNull();
    expect(user.onboarded).toBe(false);
  });

  test('wrong code is rejected and the OTP locks after 5 tries', async () => {
    const email = 'x@example.com';
    const { body } = await request(app).post('/api/auth/otp/request').send({ email });
    const wrong = body.devCode === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/auth/otp/verify').send({ email, code: wrong }).expect(400);
    }
    await request(app).post('/api/auth/otp/verify').send({ email, code: body.devCode }).expect(400);
  });

  test('ADMIN_EMAILS become admins on sign-in', async () => {
    const { user } = await signIn('admin@test.local');
    expect(user.role).toBe('admin');
  });

  test('/me needs a valid token', async () => {
    await request(app).get('/api/auth/me').expect(401);
    await request(app).get('/api/auth/me').set('Authorization', 'Bearer nope').expect(401);
  });
});

describe('rate limits', () => {
  test('page loads (/auth/me, /auth/config) are never rate limited, even from one IP', async () => {
    const limited = createApp({ rateLimits: true });
    const { auth } = await signIn('busy@example.com');
    for (let i = 0; i < 60; i++) {
      await request(limited).get('/api/auth/config').expect(200);
      await request(limited).get('/api/auth/me').set(auth).expect(200);
    }
  });

  test('signed-in limits are per person, so a shared Wi-Fi does not lock everyone out', async () => {
    const limited = createApp({ rateLimits: true });
    const a = await signIn('a@example.com');
    const b = await signIn('b@example.com');
    await request(limited).post('/api/onboarding/role').set(a.auth).send({ role: 'creator' });
    await request(limited).post('/api/onboarding/role').set(b.auth).send({ role: 'creator' });
    for (let i = 0; i < 120; i++) await request(limited).get('/api/social/accounts').set(a.auth);
    await request(limited).get('/api/social/accounts').set(a.auth).expect(429);
    await request(limited).get('/api/social/accounts').set(b.auth).expect(200);
  });
});

describe('google sign-in (firebase)', () => {
  const firebase = require('../src/lib/firebase');
  const claims = (over = {}) => ({
    uid: 'g-uid-1',
    email: 'Riya@Gmail.com',
    email_verified: true,
    name: 'Riya Sharma',
    picture: 'https://lh3.googleusercontent.com/a/x',
    firebase: { sign_in_provider: 'google.com' },
    ...over,
  });
  afterEach(() => jest.restoreAllMocks());

  test('first sign-in creates the account; next sign-in reuses it', async () => {
    jest.spyOn(firebase, 'verifyFirebaseToken').mockResolvedValue(claims());
    const a = await request(app).post('/api/auth/firebase').send({ idToken: 'x'.repeat(30) }).expect(200);
    expect(a.body.user).toMatchObject({ email: 'riya@gmail.com', name: 'Riya Sharma', role: null, avatarUrl: expect.stringContaining('googleusercontent') });
    const b = await request(app).post('/api/auth/firebase').send({ idToken: 'y'.repeat(30) }).expect(200);
    expect(b.body.user.id).toBe(a.body.user.id);
    await request(app).get('/api/auth/me').set('Authorization', `Bearer ${b.body.token}`).expect(200);
  });

  test('links to an existing account with the same email', async () => {
    const existing = await signIn('riya@gmail.com');
    jest.spyOn(firebase, 'verifyFirebaseToken').mockResolvedValue(claims());
    const res = await request(app).post('/api/auth/firebase').send({ idToken: 'x'.repeat(30) }).expect(200);
    expect(res.body.user.id).toBe(existing.user.id);
  });

  test('rejects bad tokens, non-Google providers and unverified emails', async () => {
    jest.spyOn(firebase, 'verifyFirebaseToken').mockRejectedValueOnce(new Error('bad'));
    await request(app).post('/api/auth/firebase').send({ idToken: 'x'.repeat(30) }).expect(401);
    firebase.verifyFirebaseToken.mockResolvedValueOnce(claims({ firebase: { sign_in_provider: 'password' } }));
    await request(app).post('/api/auth/firebase').send({ idToken: 'x'.repeat(30) }).expect(400);
    firebase.verifyFirebaseToken.mockResolvedValueOnce(claims({ email_verified: false }));
    await request(app).post('/api/auth/firebase').send({ idToken: 'x'.repeat(30) }).expect(400);
  });

  test('the real token check runs and rejects a forged token (no stub)', async () => {
    process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'test-project';
    require('../src/config').firebaseProjectId ||= 'test-project';
    const forged = 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImFiYyJ9.eyJhdWQiOiJ4In0.c2lnbmF0dXJl';
    const res = await request(app).post('/api/auth/firebase').send({ idToken: forged });
    expect(res.status).toBe(401);
  });

  test('ADMIN_EMAILS are promoted on Google sign-in too', async () => {
    jest.spyOn(firebase, 'verifyFirebaseToken').mockResolvedValue(claims({ uid: 'g-admin', email: 'admin@test.local' }));
    const res = await request(app).post('/api/auth/firebase').send({ idToken: 'x'.repeat(30) }).expect(200);
    expect(res.body.user.role).toBe('admin');
  });
});

describe('onboarding', () => {
  test('role can only be creator or brand, and only once', async () => {
    const { auth } = await signIn('c@example.com');
    await request(app).post('/api/onboarding/role').set(auth).send({ role: 'admin' }).expect(400);
    await request(app).post('/api/onboarding/role').set(auth).send({ role: 'creator' }).expect(200);
    await request(app).post('/api/onboarding/role').set(auth).send({ role: 'brand' }).expect(409);
  });

  test('creator onboarding needs nothing; name falls back; UPI is checked at payout', async () => {
    const { auth } = await signIn('riya.s@example.com');
    await request(app).post('/api/onboarding/role').set(auth).send({ role: 'creator' });
    const res = await request(app).post('/api/onboarding/creator').set(auth).send({}).expect(200);
    expect(res.body.user).toMatchObject({ onboarded: true, name: 'riya.s' });

    await request(app).put('/api/onboarding/payout').set(auth).send({ upiId: 'bad' }).expect(400);
    const ok = await request(app).put('/api/onboarding/payout').set(auth).send({ upiId: 'riya@okicici' }).expect(200);
    expect(ok.body.user.creator.upiId).toBe('riya@okicici');

    const named = await request(app).post('/api/onboarding/creator').set(auth).send({ name: 'Riya Sharma' }).expect(200);
    expect(named.body.user).toMatchObject({ name: 'Riya Sharma', creator: { upiId: 'riya@okicici' } });
  });

  test('a creator cannot use brand onboarding', async () => {
    const { auth } = await signIn('c@example.com');
    await request(app).post('/api/onboarding/role').set(auth).send({ role: 'creator' });
    await request(app).post('/api/onboarding/brand').set(auth).send({ company: 'X', contactName: 'Y' }).expect(403);
  });
});

describe('brand approval', () => {
  async function brandSignup() {
    const s = await signIn('founder@brand.in');
    await request(app).post('/api/onboarding/role').set(s.auth).send({ role: 'brand' });
    const res = await request(app)
      .post('/api/onboarding/brand')
      .set(s.auth)
      .send({ company: 'Chai Co', contactName: 'Asha', vertical: 'genz', gstin: '27aapfu0939f1zv' })
      .expect(200);
    return { ...s, brandId: res.body.brand._id };
  }

  test('new brands start pending and admin can approve', async () => {
    const brand = await brandSignup();
    const me = await request(app).get('/api/auth/me').set(brand.auth).expect(200);
    expect(me.body.brand.approvalStatus).toBe('pending');
    expect(me.body.brand.gstin).toBe('27AAPFU0939F1ZV');

    const admin = await signIn('admin@test.local');
    const list = await request(app).get('/api/admin/brands?status=pending').set(admin.auth).expect(200);
    expect(list.body.brands).toHaveLength(1);
    expect(list.body.brands[0].ownerId.email).toBe('founder@brand.in');

    await request(app).patch(`/api/admin/brands/${brand.brandId}`).set(admin.auth).send({ action: 'approve' }).expect(200);
    const after = await request(app).get('/api/auth/me').set(brand.auth);
    expect(after.body.brand.approvalStatus).toBe('approved');
  });

  test('reject and request-info need a note; resubmitting goes back to pending', async () => {
    const brand = await brandSignup();
    const admin = await signIn('admin@test.local');
    await request(app).patch(`/api/admin/brands/${brand.brandId}`).set(admin.auth).send({ action: 'reject' }).expect(400);
    await request(app)
      .patch(`/api/admin/brands/${brand.brandId}`)
      .set(admin.auth)
      .send({ action: 'request_info', note: 'Add your website' })
      .expect(200);

    const res = await request(app)
      .post('/api/onboarding/brand')
      .set(brand.auth)
      .send({ company: 'Chai Co', contactName: 'Asha', website: 'chaico.in' })
      .expect(200);
    expect(res.body.brand.approvalStatus).toBe('pending');
    expect(res.body.brand._id).toBe(brand.brandId);
  });

  test('only admins can reach admin routes', async () => {
    const brand = await brandSignup();
    await request(app).get('/api/admin/brands').set(brand.auth).expect(403);
    await request(app).patch(`/api/admin/brands/${brand.brandId}`).set(brand.auth).send({ action: 'approve' }).expect(403);
  });
});

describe('campaigns', () => {
  const Campaign = require('../src/models/Campaign');
  const Brand = require('../src/models/Brand');
  const User = require('../src/models/User');

  async function makeCampaign({ approved = true, status = 'live' } = {}) {
    const owner = await User.create({ email: `b${Math.random()}@x.in`, role: 'brand', onboarded: true });
    const brand = await Brand.create({ ownerId: owner._id, company: 'Chai Co', contactName: 'Asha', approvalStatus: approved ? 'approved' : 'pending' });
    return Campaign.create({
      brandId: brand._id,
      title: 'Launch',
      ratePer1kPaise: 5000,
      budgetPaise: 1000000,
      spentPaise: 250000,
      platforms: ['instagram'],
      endsAt: new Date(Date.now() + 86400000),
      status,
    });
  }

  test('anyone can browse live campaigns from approved brands only', async () => {
    const live = await makeCampaign();
    await makeCampaign({ approved: false });
    await makeCampaign({ status: 'draft' });
    const res = await request(app).get('/api/campaigns').expect(200);
    expect(res.body.campaigns).toHaveLength(1);
    expect(res.body.campaigns[0]).toMatchObject({ id: live.id, budgetLeftPct: 75, brand: { name: 'Chai Co' }, joined: false });

    const one = await request(app).get(`/api/campaigns/${live.id}`).expect(200);
    expect(one.body.campaign.creators).toBe(0);
    await request(app).get('/api/campaigns/not-an-id').expect(404);
  });

  test('joining needs a signed-in, onboarded creator and is idempotent', async () => {
    const c = await makeCampaign();
    await request(app).post(`/api/campaigns/${c.id}/join`).expect(401);

    const s = await signIn('clipper@example.com');
    await request(app).post('/api/onboarding/role').set(s.auth).send({ role: 'creator' });
    await request(app).post(`/api/campaigns/${c.id}/join`).set(s.auth).expect(403);
    await request(app).post('/api/onboarding/creator').set(s.auth).send({ name: 'Riya', instagram: 'riya' });
    await request(app).post(`/api/campaigns/${c.id}/join`).set(s.auth).expect(200);
    await request(app).post(`/api/campaigns/${c.id}/join`).set(s.auth).expect(200);

    const detail = await request(app).get(`/api/campaigns/${c.id}`).set(s.auth);
    expect(detail.body.campaign).toMatchObject({ joined: true, creators: 1 });
    const mine = await request(app).get('/api/campaigns/mine').set(s.auth).expect(200);
    expect(mine.body.campaigns).toHaveLength(1);
  });
});

describe('leads', () => {
  test('public form saves a lead; honeypot blocks bots', async () => {
    await request(app)
      .post('/api/leads')
      .send({ name: 'Bot', company: 'Spam', email: 'b@spam.com', website: 'http://spam' })
      .expect(400);
    await request(app).post('/api/leads').send({ name: 'Asha', company: 'Chai Co', email: 'asha@chaico.in' }).expect(201);

    const admin = await signIn('admin@test.local');
    const res = await request(app).get('/api/admin/leads').set(admin.auth).expect(200);
    expect(res.body.leads).toHaveLength(1);
    expect(res.body.leads[0].status).toBe('new');
  });
});
