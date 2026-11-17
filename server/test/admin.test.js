process.env.ADMIN_EMAILS = 'boss@test.local';
process.env.MONGODB_URI = '';

const request = require('supertest');
const mongoose = require('mongoose');
const crypto = require('crypto');
const config = require('../src/config');
const { connectDb, disconnectDb } = require('../src/db');
const { createApp } = require('../src/app');
const { signUpload, cloudinaryConfig } = require('../src/lib/cloudinary');

let app;
beforeAll(async () => {
  config.adminEmails = ['boss@test.local'];
  await connectDb({ inMemory: true });
  app = createApp();
});
afterAll(disconnectDb);
beforeEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
});

async function signIn(email) {
  const { body } = await request(app).post('/api/auth/otp/request').send({ email });
  const res = await request(app).post('/api/auth/otp/verify').send({ email, code: body.devCode });
  return { Authorization: `Bearer ${res.body.token}` };
}

const inDays = (n) => new Date(Date.now() + n * 86400000).toISOString();
const base = (brandId, over = {}) => ({
  brandId,
  title: 'Masala launch clips',
  brief: 'Short reaction clips to the new flavour.',
  vertical: 'genz',
  type: 'ugc',
  platforms: ['instagram', 'instagram'],
  ratePer1k: 55.5,
  budget: 25000,
  perClipCap: 5000,
  endsAt: inDays(10),
  coverUrl: 'https://res.cloudinary.com/demo/image/upload/x.jpg',
  deliverables: ['9:16, 15-60s'],
  rules: ['#ad in caption'],
  ...over,
});

describe('admin campaigns', () => {
  test('admin adds a brand, creates a draft, edits it, then takes it live and it shows publicly', async () => {
    const admin = await signIn('boss@test.local');
    const b = await request(app).post('/api/admin/brands').set(admin).send({ company: 'SnackBox', contactName: 'Kabir', email: 'Kabir@SnackBox.in', vertical: 'genz' }).expect(201);
    expect(b.body.brand.approvalStatus).toBe('approved');

    const created = await request(app).post('/api/admin/campaigns').set(admin).send(base(b.body.brand._id)).expect(201);
    const c = created.body.campaign;
    expect(c).toMatchObject({ status: 'draft', ratePer1k: 55.5, ratePer1kPaise: 5550, budget: 25000, perClipCap: 5000, platforms: ['instagram'] });
    expect((await request(app).get('/api/campaigns')).body.campaigns).toHaveLength(0);

    const edited = await request(app).put(`/api/admin/campaigns/${c.id}`).set(admin).send(base(b.body.brand._id, { title: 'Masala launch: reactions', budget: 30000 })).expect(200);
    expect(edited.body.campaign).toMatchObject({ title: 'Masala launch: reactions', budget: 30000 });

    await request(app).patch(`/api/admin/campaigns/${c.id}/status`).set(admin).send({ status: 'live' }).expect(200);
    const pub = await request(app).get('/api/campaigns').expect(200);
    expect(pub.body.campaigns.map((x) => x.title)).toEqual(['Masala launch: reactions']);

    await request(app).patch(`/api/admin/campaigns/${c.id}/status`).set(admin).send({ status: 'paused' }).expect(200);
    expect((await request(app).get('/api/campaigns')).body.campaigns).toHaveLength(0);
    await request(app).delete(`/api/admin/campaigns/${c.id}`).set(admin).expect(400); // only drafts
    const list = await request(app).get('/api/admin/campaigns').set(admin).expect(200);
    expect(list.body.counts).toEqual({ paused: 1 });

    // The brand's owner later signs in with that email and gets the brand.
    const owner = await signIn('kabir@snackbox.in');
    const me = await request(app).get('/api/auth/me').set(owner);
    expect(me.body.user).toMatchObject({ role: 'brand', onboarded: true });
    expect(me.body.brand.company).toBe('SnackBox');
  });

  test('validation: future end date, sane money, https images, approved brand to go live', async () => {
    const admin = await signIn('boss@test.local');
    const owner = await signIn('pending@brand.in');
    await request(app).post('/api/onboarding/role').set(owner).send({ role: 'brand' });
    const pb = await request(app).post('/api/onboarding/brand').set(owner).send({ company: 'Pending Co', contactName: 'Asha' });
    const pendingId = pb.body.brand._id;

    await request(app).post('/api/admin/campaigns').set(admin).send(base(pendingId, { endsAt: inDays(-1) })).expect(400);
    await request(app).post('/api/admin/campaigns').set(admin).send(base(pendingId, { budget: 10 })).expect(400);
    await request(app).post('/api/admin/campaigns').set(admin).send(base(pendingId, { coverUrl: 'http://insecure.example/x.jpg' })).expect(400);
    await request(app).post('/api/admin/campaigns').set(admin).send(base(pendingId, { platforms: [] })).expect(400);
    const live = await request(app).post('/api/admin/campaigns').set(admin).send({ ...base(pendingId), status: 'live' }).expect(400);
    expect(live.body.error).toMatch(/Approve this brand/);

    const draft = await request(app).post('/api/admin/campaigns').set(admin).send(base(pendingId)).expect(201);
    await request(app).patch(`/api/admin/campaigns/${draft.body.campaign.id}/status`).set(admin).send({ status: 'live' }).expect(400);
    await request(app).delete(`/api/admin/campaigns/${draft.body.campaign.id}`).set(admin).expect(200);
  });

  test('scheduled campaigns stay hidden until their start date', async () => {
    const admin = await signIn('boss@test.local');
    const b = await request(app).post('/api/admin/brands').set(admin).send({ company: 'Later Co', contactName: 'Rohan', email: 'r@later.in' });
    await request(app).post('/api/admin/campaigns').set(admin).send({ ...base(b.body.brand._id, { startsAt: inDays(2) }), status: 'live' }).expect(201);
    expect((await request(app).get('/api/campaigns')).body.campaigns).toHaveLength(0);
  });

  test('only admins can manage campaigns', async () => {
    const someone = await signIn('creator@x.in');
    await request(app).get('/api/admin/campaigns').set(someone).expect(403);
    await request(app).post('/api/admin/brands').set(someone).send({}).expect(403);
  });
});

describe('cloudinary uploads', () => {
  test('config parses CLOUDINARY_URL and signing matches Cloudinary’s scheme', () => {
    expect(cloudinaryConfig({ CLOUDINARY_URL: 'cloudinary://123:abc@my-cloud' })).toEqual({ cloudName: 'my-cloud', apiKey: '123', apiSecret: 'abc' });
    const sig = signUpload({ timestamp: 1700000000, folder: 'f' }, 'secret');
    expect(sig).toBe(crypto.createHash('sha1').update('folder=f&timestamp=1700000000secret').digest('hex'));
  });

  test('signature endpoint works when configured, explains when not', async () => {
    const admin = await signIn('boss@test.local');
    // Hide any real Cloudinary settings from .env for this test.
    const KEYS = ['CLOUDINARY_URL', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
    const real = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
    KEYS.forEach((k) => delete process.env[k]);
    const saved = undefined;
    await request(app).get('/api/admin/uploads/signature').set(admin).expect(503);
    process.env.CLOUDINARY_URL = 'cloudinary://123:abc@my-cloud';
    const res = await request(app).get('/api/admin/uploads/signature').set(admin).expect(200);
    expect(res.body).toMatchObject({ cloudName: 'my-cloud', apiKey: '123', folder: 'cliprewards/campaigns' });
    expect(res.body).not.toHaveProperty('apiSecret');
    delete process.env.CLOUDINARY_URL;
    for (const [k, v] of Object.entries(real)) if (v !== undefined) process.env[k] = v;
    void saved;
  });
});
