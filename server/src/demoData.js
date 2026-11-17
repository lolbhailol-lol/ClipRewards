/**
 * Demo brands and campaigns, shared by `npm run seed` (local) and
 * `npm run demo:add` / `npm run demo:remove` (any database, e.g. production).
 * Everything demo is tied to @demo.local emails, so it can be removed cleanly.
 */
const mongoose = require('mongoose');
const User = require('./models/User');
const Brand = require('./models/Brand');
const Campaign = require('./models/Campaign');
const Participation = require('./models/Participation');

const DEMO_EMAIL = /@demo\.local$/;

const BRANDS = [
  { email: 'campusapp@demo.local', company: 'CampusApp (demo)', contactName: 'Neha', vertical: 'genz', website: 'campusapp.example', approvalStatus: 'pending' },
  { email: 'chaicast@demo.local', company: 'Chai Cast Podcast (demo)', contactName: 'Rohan', vertical: 'podcast', website: '@chaicast', approvalStatus: 'pending' },
  { email: 'beatlabel@demo.local', company: 'Beat Label (demo)', contactName: 'Isha', vertical: 'music', approvalStatus: 'approved' },
  { email: 'snackbox@demo.local', company: 'SnackBox (demo)', contactName: 'Kabir', vertical: 'genz', approvalStatus: 'approved' },
  { email: 'mitrapod@demo.local', company: 'Mitra Podcast (demo)', contactName: 'Aditi', vertical: 'podcast', approvalStatus: 'approved' },
];

const U = (id) => `https://images.unsplash.com/photo-${id}`;
const MEDIA = {
  'New masala flavour launch': [U('1522202176988-66273c2fd55f'), [U('1523240795612-9a054b0db644'), U('1517457373958-b7bdd4587205')]],
  'Hostel snack hacks': [U('1523240795612-9a054b0db644'), [U('1522202176988-66273c2fd55f'), U('1541462608143-67571c6738dd')]],
  '“Neon Raat” single release': [U('1493225457124-a3eb161ffa5f'), [U('1501612780327-45045538702b'), U('1470225620780-dba8ba36b745'), U('1517457373958-b7bdd4587205')]],
  'Lo-fi study beats': [U('1484755560615-a4c64e778a6c'), [U('1505740420928-5e560c06d30e'), U('1598488035139-bdbb2231ce04')]],
  'Founder stories: best moments': [U('1478737270239-2f02b77fc618'), [U('1590602847861-f357a9332bbc'), U('1511671782779-c97d3d27a1d4')]],
  'Marathi episode highlights': [U('1516280440614-37939bbacd81'), [U('1511671782779-c97d3d27a1d4'), U('1590602847861-f357a9332bbc')]],
};

const DELIVERABLES = ['Vertical video, 9:16', '15–60 seconds long', 'Your own hook in the first 2 seconds', 'On-screen captions', '#ad in the caption'];
const RULES = ['Add #ad in the caption', 'Post from your own public account', 'Add your own hook and captions, no plain re-uploads', 'No misleading or out-of-context edits'];
const days = (n) => new Date(Date.now() + n * 86400000);

// [brand email, campaign]
const CAMPAIGNS = () => [
  ['snackbox@demo.local', { title: 'New masala flavour launch', vertical: 'genz', type: 'ugc', platforms: ['instagram'], ratePer1kPaise: 6000, budgetPaise: 2500000, spentPaise: 800000, endsAt: days(30), brief: 'Film a 15–30s reaction to the new masala flavour. Real reactions, campus setting works best.' }],
  ['snackbox@demo.local', { title: 'Hostel snack hacks', vertical: 'genz', type: 'clipping', platforms: ['instagram', 'youtube'], ratePer1kPaise: 4000, budgetPaise: 1500000, spentPaise: 1100000, endsAt: days(21), brief: 'Cut our hostel-hacks video into short, fast clips with your own captions.' }],
  ['beatlabel@demo.local', { title: '“Neon Raat” single release', vertical: 'music', type: 'clipping', platforms: ['instagram', 'youtube'], ratePer1kPaise: 5000, budgetPaise: 5000000, spentPaise: 900000, endsAt: days(35), brief: 'Use the hook (0:42–0:58) in trend edits, dance clips or lyric edits.' }],
  ['beatlabel@demo.local', { title: 'Lo-fi study beats', vertical: 'music', type: 'clipping', platforms: ['youtube'], ratePer1kPaise: 3000, budgetPaise: 1000000, spentPaise: 200000, endsAt: days(40), brief: 'Pair the tracks with study-with-me or aesthetic room clips.' }],
  ['mitrapod@demo.local', { title: 'Founder stories: best moments', vertical: 'podcast', type: 'clipping', platforms: ['instagram', 'youtube'], ratePer1kPaise: 4500, budgetPaise: 3000000, spentPaise: 1500000, endsAt: days(28), brief: 'Clip the strongest 30–60s moments from episodes 12–18. Strong hook in the first 2 seconds.' }],
  ['mitrapod@demo.local', { title: 'Marathi episode highlights', vertical: 'regional', type: 'clipping', platforms: ['instagram'], ratePer1kPaise: 7000, budgetPaise: 1200000, spentPaise: 100000, endsAt: days(25), brief: 'Highlights from our Marathi episodes, with Marathi captions.' }],
];

/** Deletes every demo brand, campaign, participation and @demo.local user. Real data is untouched. */
async function removeDemo() {
  const users = await User.find({ email: DEMO_EMAIL }, '_id');
  const brands = await Brand.find({ ownerId: { $in: users.map((u) => u._id) } }, '_id');
  const campaigns = await Campaign.find({ brandId: { $in: brands.map((b) => b._id) } }, '_id');
  const parts = await Participation.deleteMany({ campaignId: { $in: campaigns.map((c) => c._id) } });
  const c = await Campaign.deleteMany({ _id: { $in: campaigns.map((x) => x._id) } });
  const b = await Brand.deleteMany({ _id: { $in: brands.map((x) => x._id) } });
  const u = await User.deleteMany({ email: DEMO_EMAIL });
  return { users: u.deletedCount, brands: b.deletedCount, campaigns: c.deletedCount, participations: parts.deletedCount };
}

/** Creates demo brands (optionally only approved ones) and their live campaigns. */
async function addDemoCampaigns({ approvedOnly = false } = {}) {
  const brandIds = {};
  for (const b of BRANDS.filter((x) => !approvedOnly || x.approvalStatus === 'approved')) {
    const userId = new mongoose.Types.ObjectId();
    const brandId = new mongoose.Types.ObjectId();
    await User.create({ _id: userId, email: b.email, name: b.contactName, role: 'brand', onboarded: true, brandId });
    await Brand.create({ ...b, _id: brandId, ownerId: userId });
    brandIds[b.email] = brandId;
  }
  let created = 0;
  for (const [email, c] of CAMPAIGNS()) {
    if (!brandIds[email]) continue;
    const [coverUrl, gallery] = MEDIA[c.title] || ['', []];
    await Campaign.create({ ...c, brandId: brandIds[email], rules: RULES, deliverables: DELIVERABLES, coverUrl, gallery, status: 'live', perClipCapPaise: 500000 });
    created++;
  }
  return { brands: Object.keys(brandIds).length, campaigns: created };
}

module.exports = { DEMO_EMAIL, removeDemo, addDemoCampaigns };
