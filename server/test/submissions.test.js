process.env.MONGODB_URI = '';

const request = require('supertest');
const mongoose = require('mongoose');
const config = require('../src/config');
const { connectDb, disconnectDb } = require('../src/db');
const { createApp } = require('../src/app');
const Campaign = require('../src/models/Campaign');
const Earning = require('../src/models/Earning');
const Submission = require('../src/models/Submission');
const tracking = require('../src/lib/tracking');

let app;
beforeAll(async () => {
  config.adminEmails = ['boss@test.local'];
  config.youtubeApiKey = 'yt-key';
  await connectDb({ inMemory: true });
  app = createApp();
});
afterAll(disconnectDb);
beforeEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
});
afterEach(() => jest.restoreAllMocks());

// Fake YouTube: channel UC1 owns videos; views can be changed between calls.
let views = {};
function fakeYouTube({ owner = 'UC1' } = {}) {
  return jest.spyOn(global, 'fetch').mockImplementation(async (url) => {
    const u = String(url);
    if (u.includes('/channels?') && u.includes('mine=true')) {
      return new Response(JSON.stringify({ items: [{ id: owner, snippet: { title: 'Riya', customUrl: '@riya' }, statistics: { subscriberCount: '900' } }] }));
    }
    if (u.includes('/videos?')) {
      const ids = new URL(u).searchParams.get('id').split(',');
      const items = ids.filter((id) => views[id] != null).map((id) => ({
        id,
        snippet: { channelId: id.startsWith('X') ? 'UC_OTHER' : 'UC1', title: `Short ${id}`, publishedAt: new Date().toISOString() },
        contentDetails: { duration: id.startsWith('L') ? 'PT10M' : 'PT30S' },
        statistics: { viewCount: String(views[id].v), likeCount: String(views[id].l ?? Math.round(views[id].v / 20)), commentCount: '10' },
      }));
      return new Response(JSON.stringify({ items }));
    }
    throw new Error(`unexpected fetch ${u}`);
  });
}

async function signIn(email) {
  const { body } = await request(app).post('/api/auth/otp/request').send({ email });
  const res = await request(app).post('/api/auth/otp/verify').send({ email, code: body.devCode });
  return { Authorization: `Bearer ${res.body.token}` };
}

async function setup({ rate = 50, budget = 2000, cap = 500 } = {}) {
  const admin = await signIn('boss@test.local');
  const b = await request(app).post('/api/admin/brands').set(admin).send({ company: 'Chai Co', contactName: 'Asha', email: `asha${Math.random()}@chai.in` });
  const c = await request(app)
    .post('/api/admin/campaigns')
    .set(admin)
    .send({ brandId: b.body.brand._id, title: 'Chai clips', brief: 'Chai moments please.', vertical: 'genz', type: 'clipping', platforms: ['youtube'], ratePer1k: rate, budget, perClipCap: cap, endsAt: new Date(Date.now() + 10 * 86400000).toISOString(), status: 'live' });
  const creator = await signIn(`c${Math.random()}@x.in`);
  await request(app).post('/api/onboarding/role').set(creator).send({ role: 'creator' });
  await request(app).post('/api/onboarding/creator').set(creator).send({ name: 'Riya' });
  fakeYouTube();
  await request(app).post('/api/social/youtube/connect').set(creator).send({ accessToken: 'g'.repeat(30) }).expect(200);
  return { admin, creator, campaignId: c.body.campaign.id };
}

const submit = (auth, campaignId, id) => request(app).post('/api/submissions').set(auth).send({ campaignId, url: `https://youtube.com/shorts/${id}` });

test('earnings unit math: rate and per-clip cap', () => {
  expect(tracking.earnedFor(12345, 5000, 0)).toBe(61725); // ₹50/1K × 12,345 views = ₹617.25
  expect(tracking.earnedFor(1_000_000, 5000, 50000)).toBe(50000);
});

test('submit → approve → on hold → withdrawable after 7 days → withdraw → admin pays', async () => {
  const { admin, creator, campaignId } = await setup({ rate: 50, budget: 20000, cap: 50000 });
  views = { AAAAAAAAAAA: { v: 4000 } };

  const s = await submit(creator, campaignId, 'AAAAAAAAAAA').expect(201);
  expect(s.body.submission).toMatchObject({ status: 'pending', views: 4000, earnedPaise: 0 });
  await submit(creator, campaignId, 'AAAAAAAAAAA').expect(409); // once per post

  // Pending clips don't earn.
  await request(app).post('/api/admin/submissions/sync').set(admin).expect(200);
  expect((await request(app).get('/api/submissions/wallet').set(creator)).body.wallet.totalEarnedPaise).toBe(0);

  await request(app).patch(`/api/admin/submissions/${s.body.submission.id}`).set(admin).send({ action: 'approve' }).expect(200);
  let w = (await request(app).get('/api/submissions/wallet').set(creator)).body.wallet;
  expect(w).toMatchObject({ totalEarnedPaise: 20000, onHoldPaise: 20000, withdrawablePaise: 0 }); // 4000 views × ₹50/1K = ₹200

  // Views grow; next sync credits only the difference.
  views.AAAAAAAAAAA.v = 6000;
  await request(app).post('/api/admin/submissions/sync').set(admin).expect(200);
  w = (await request(app).get('/api/submissions/wallet').set(creator)).body.wallet;
  expect(w.totalEarnedPaise).toBe(30000);
  expect((await Campaign.findById(campaignId)).spentPaise).toBe(30000);

  // After the 7-day hold the money is withdrawable.
  await request(app).post('/api/submissions/wallet/withdraw').set(creator).expect(400);
  await Earning.updateMany({}, { availableAt: new Date(Date.now() - 1000) });
  const noUpi = await request(app).post('/api/submissions/wallet/withdraw').set(creator).expect(400);
  expect(noUpi.body.code).toBe('no_upi');
  await request(app).put('/api/onboarding/payout').set(creator).send({ upiId: 'riya@okicici' }).expect(200);
  const wd = await request(app).post('/api/submissions/wallet/withdraw').set(creator).expect(201);
  expect(wd.body.withdrawal).toMatchObject({ amountPaise: 30000, upiId: 'riya@okicici', status: 'requested' });
  expect(wd.body.wallet.withdrawablePaise).toBe(0);
  await request(app).post('/api/submissions/wallet/withdraw').set(creator).expect(409);

  const list = await request(app).get('/api/admin/withdrawals?status=requested').set(admin).expect(200);
  expect(list.body.requestedTotalPaise).toBe(30000);
  await request(app).patch(`/api/admin/withdrawals/${wd.body.withdrawal.id}`).set(admin).send({ action: 'paid', reference: 'UTR123456789' }).expect(200);
  w = (await request(app).get('/api/submissions/wallet').set(creator)).body;
  expect(w.wallet).toMatchObject({ paidOutPaise: 30000, withdrawablePaise: 0 });
  expect(w.activity.map((a) => a.kind)).toContain('withdrawal');
});

test('per-clip cap and campaign budget are never exceeded', async () => {
  const { admin, creator, campaignId } = await setup({ rate: 100, budget: 1500, cap: 1000 });
  views = { BBBBBBBBBBB: { v: 50000 }, CCCCCCCCCCC: { v: 50000 } };
  for (const id of Object.keys(views)) {
    const s = await submit(creator, campaignId, id).expect(201);
    await request(app).patch(`/api/admin/submissions/${s.body.submission.id}`).set(admin).send({ action: 'approve' }).expect(200);
  }
  const subs = await Submission.find().sort({ createdAt: 1 });
  expect(subs.map((s) => s.earnedPaise)).toEqual([100000, 50000]); // first hits the ₹1,000 cap, second gets the ₹500 left
  expect((await Campaign.findById(campaignId)).spentPaise).toBe(150000);
  // Budget used up → new clips refused, campaign drops from the public feed.
  views.DDDDDDDDDDD = { v: 10 };
  await submit(creator, campaignId, 'DDDDDDDDDDD').expect(400);
  expect((await request(app).get('/api/campaigns')).body.campaigns).toHaveLength(0);
});

test('rejecting an approved clip reverses its earnings and refunds the budget', async () => {
  const { admin, creator, campaignId } = await setup({ rate: 50, budget: 5000, cap: 0 });
  views = { EEEEEEEEEEE: { v: 10000 } };
  const s = await submit(creator, campaignId, 'EEEEEEEEEEE').expect(201);
  await request(app).patch(`/api/admin/submissions/${s.body.submission.id}`).set(admin).send({ action: 'approve' });
  await request(app).patch(`/api/admin/submissions/${s.body.submission.id}`).set(admin).send({ action: 'reject' }).expect(400); // needs a reason
  await request(app).patch(`/api/admin/submissions/${s.body.submission.id}`).set(admin).send({ action: 'reject', note: 'Re-upload, no edit' }).expect(200);
  const w = (await request(app).get('/api/submissions/wallet').set(creator)).body.wallet;
  expect(w.totalEarnedPaise).toBe(0);
  expect((await Campaign.findById(campaignId)).spentPaise).toBe(0);
});

test('only your own Shorts, on allowed platforms, can be submitted', async () => {
  const { creator, campaignId } = await setup();
  views = { XXXXXXXXXXX: { v: 100 }, LLLLLLLLLLL: { v: 100 } };
  const other = await submit(creator, campaignId, 'XXXXXXXXXXX').expect(403);
  expect(other.body.error).toMatch(/isn’t on your connected YouTube channel/);
  const long = await submit(creator, campaignId, 'LLLLLLLLLLL').expect(400);
  expect(long.body.error).toMatch(/Short/);
  // This campaign is YouTube-only, so an Instagram link is refused before any account check.
  const ig = await request(app).post('/api/submissions').set(creator).send({ campaignId, url: 'https://www.instagram.com/reel/C9xYz12AbCd/' }).expect(400);
  expect(ig.body.error).toBe('This campaign only accepts YouTube Shorts');
});

test('suspicious engagement is flagged and stops earning until cleared', async () => {
  const { admin, creator, campaignId } = await setup({ rate: 10, budget: 100000, cap: 0 });
  views = { FFFFFFFFFFF: { v: 200000, l: 5 } };
  const s = await submit(creator, campaignId, 'FFFFFFFFFFF').expect(201);
  await request(app).patch(`/api/admin/submissions/${s.body.submission.id}`).set(admin).send({ action: 'approve' });
  // Approval credited immediately; the sync then flags it.
  await Submission.updateOne({}, { earnedPaise: 0 });
  await Earning.deleteMany({});
  await Campaign.updateOne({ _id: campaignId }, { spentPaise: 0 });
  await request(app).post('/api/admin/submissions/sync').set(admin).expect(200);
  const flagged = await request(app).get('/api/admin/submissions?status=flagged').set(admin).expect(200);
  expect(flagged.body.submissions[0]).toMatchObject({ flagged: true });
  expect((await request(app).get('/api/submissions/wallet').set(creator)).body.wallet.totalEarnedPaise).toBe(0);

  await request(app).patch(`/api/admin/submissions/${s.body.submission.id}`).set(admin).send({ action: 'clear_flag' }).expect(200);
  expect((await request(app).get('/api/submissions/wallet').set(creator)).body.wallet.totalEarnedPaise).toBe(200000);
});
