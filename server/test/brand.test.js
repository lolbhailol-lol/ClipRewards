process.env.MONGODB_URI = '';

const request = require('supertest');
const mongoose = require('mongoose');
const { connectDb, disconnectDb } = require('../src/db');
const { createApp } = require('../src/app');
const { signToken } = require('../src/middleware/auth');
const User = require('../src/models/User');
const Brand = require('../src/models/Brand');
const Campaign = require('../src/models/Campaign');
const Participation = require('../src/models/Participation');
const Submission = require('../src/models/Submission');
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

const days = (n) => new Date(Date.now() + n * 86400000);

async function makeBrand(email, company) {
  const userId = new mongoose.Types.ObjectId();
  const brandId = new mongoose.Types.ObjectId();
  const user = await User.create({ _id: userId, email, role: 'brand', onboarded: true, brandId });
  await Brand.create({ _id: brandId, ownerId: userId, company, contactName: 'X', vertical: 'genz', approvalStatus: 'approved' });
  const campaign = await Campaign.create({
    brandId, title: `${company} launch`, vertical: 'genz', type: 'clipping', platforms: ['youtube'], ratePer1kPaise: 5000,
    budgetPaise: 1000000, spentPaise: 25000, endsAt: days(20), status: 'live', brief: 'Clip it',
  });
  return { auth: { Authorization: `Bearer ${signToken(user)}` }, campaign };
}

async function clip(campaign, status, views, postId) {
  const creatorId = new mongoose.Types.ObjectId();
  const acc = await SocialAccount.create({ userId: creatorId, platform: 'youtube', externalId: `UC${postId}`, username: `@maker${postId}`, status: 'active' });
  await Participation.create({ campaignId: campaign._id, creatorId });
  return Submission.create({ campaignId: campaign._id, creatorId, socialAccountId: acc._id, platform: 'youtube', postId, url: `https://youtube.com/shorts/${postId}`, status, views });
}

test('a brand sees only its own campaigns, with results from approved clips', async () => {
  const mine = await makeBrand('me@brand.test', 'Mine');
  const other = await makeBrand('other@brand.test', 'Other');
  await clip(mine.campaign, 'approved', 5000, 'a1');
  await clip(mine.campaign, 'pending', 900, 'a2');
  await clip(mine.campaign, 'rejected', 7777, 'a3');
  await clip(other.campaign, 'approved', 99999, 'b1');

  const { body } = await request(app).get('/api/brand/summary').set(mine.auth).expect(200);
  expect(body.campaigns).toHaveLength(1);
  expect(body.campaigns[0]).toMatchObject({ title: 'Mine launch', creators: 3, clips: 2, approvedClips: 1, views: 5000, spentPaise: 25000 });
  expect(body.totals).toMatchObject({ views: 5000, clips: 2, live: 1, spentPaise: 25000 });

  const clips = await request(app).get('/api/brand/clips').set(mine.auth).expect(200);
  expect(clips.body.clips.map((c) => c.creator).sort()).toEqual(['@makera1', '@makera2']); // no rejected, no other brand
});

test('only brands can use brand endpoints', async () => {
  const creator = await User.create({ email: 'c@test.local', role: 'creator', onboarded: true });
  await request(app).get('/api/brand/summary').set({ Authorization: `Bearer ${signToken(creator)}` }).expect(403);
  await request(app).get('/api/brand/summary').expect(401);
});
