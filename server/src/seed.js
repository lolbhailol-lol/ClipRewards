/**
 * Demo data so the prototype can be clicked through right away.
 * Safe to re-run: only touches the demo accounts below (all @demo.local).
 * Run with: npm run seed
 */
const mongoose = require('mongoose');
const { connectDb, disconnectDb } = require('./db');
const User = require('./models/User');
const Brand = require('./models/Brand');
const Lead = require('./models/Lead');
const Campaign = require('./models/Campaign');
const Participation = require('./models/Participation');

const BRANDS = [
  { email: 'campusapp@demo.local', company: 'CampusApp (demo)', contactName: 'Neha', vertical: 'genz', website: 'campusapp.example', approvalStatus: 'pending' },
  { email: 'chaicast@demo.local', company: 'Chai Cast Podcast (demo)', contactName: 'Rohan', vertical: 'podcast', website: '@chaicast', approvalStatus: 'pending' },
  { email: 'beatlabel@demo.local', company: 'Beat Label (demo)', contactName: 'Isha', vertical: 'music', approvalStatus: 'approved' },
  { email: 'snackbox@demo.local', company: 'SnackBox (demo)', contactName: 'Kabir', vertical: 'genz', approvalStatus: 'approved' },
  { email: 'mitrapod@demo.local', company: 'Mitra Podcast (demo)', contactName: 'Aditi', vertical: 'podcast', approvalStatus: 'approved' },
];

const MEDIA = {
 "New masala flavour launch": [
  "https://images.unsplash.com/photo-1522202176988-66273c2fd55f",
  [
   "https://images.unsplash.com/photo-1523240795612-9a054b0db644",
   "https://images.unsplash.com/photo-1517457373958-b7bdd4587205"
  ]
 ],
 "Hostel snack hacks": [
  "https://images.unsplash.com/photo-1523240795612-9a054b0db644",
  [
   "https://images.unsplash.com/photo-1522202176988-66273c2fd55f",
   "https://images.unsplash.com/photo-1541462608143-67571c6738dd"
  ]
 ],
 "“Neon Raat” single release": [
  "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f",
  [
   "https://images.unsplash.com/photo-1501612780327-45045538702b",
   "https://images.unsplash.com/photo-1470225620780-dba8ba36b745",
   "https://images.unsplash.com/photo-1517457373958-b7bdd4587205"
  ]
 ],
 "Lo-fi study beats": [
  "https://images.unsplash.com/photo-1484755560615-a4c64e778a6c",
  [
   "https://images.unsplash.com/photo-1505740420928-5e560c06d30e",
   "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04"
  ]
 ],
 "Founder stories: best moments": [
  "https://images.unsplash.com/photo-1478737270239-2f02b77fc618",
  [
   "https://images.unsplash.com/photo-1590602847861-f357a9332bbc",
   "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4"
  ]
 ],
 "Marathi episode highlights": [
  "https://images.unsplash.com/photo-1516280440614-37939bbacd81",
  [
   "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4",
   "https://images.unsplash.com/photo-1590602847861-f357a9332bbc"
  ]
 ]
};
const DELIVERABLES = ['Vertical video, 9:16', '15–60 seconds long', 'Your own hook in the first 2 seconds', 'On-screen captions', '#ad in the caption'];

const days = (n) => new Date(Date.now() + n * 86400000);
const RULES = ['Add #ad in the caption', 'Post from your own public account', 'Add your own hook and captions, no plain re-uploads', 'No misleading or out-of-context edits'];

// [brand email, campaign]
const CAMPAIGNS = [
  ['snackbox@demo.local', { title: 'New masala flavour launch', vertical: 'genz', type: 'ugc', platforms: ['instagram'], ratePer1kPaise: 6000, budgetPaise: 2500000, spentPaise: 800000, endsAt: days(9), brief: 'Film a 15–30s reaction to the new masala flavour. Real reactions, campus setting works best.' }],
  ['snackbox@demo.local', { title: 'Hostel snack hacks', vertical: 'genz', type: 'clipping', platforms: ['instagram', 'youtube'], ratePer1kPaise: 4000, budgetPaise: 1500000, spentPaise: 1100000, endsAt: days(4), brief: 'Cut our hostel-hacks video into short, fast clips with your own captions.' }],
  ['beatlabel@demo.local', { title: '“Neon Raat” single release', vertical: 'music', type: 'clipping', platforms: ['instagram', 'youtube'], ratePer1kPaise: 5000, budgetPaise: 5000000, spentPaise: 900000, endsAt: days(14), brief: 'Use the hook (0:42–0:58) in trend edits, dance clips or lyric edits.' }],
  ['beatlabel@demo.local', { title: 'Lo-fi study beats', vertical: 'music', type: 'clipping', platforms: ['youtube'], ratePer1kPaise: 3000, budgetPaise: 1000000, spentPaise: 200000, endsAt: days(20), brief: 'Pair the tracks with study-with-me or aesthetic room clips.' }],
  ['mitrapod@demo.local', { title: 'Founder stories: best moments', vertical: 'podcast', type: 'clipping', platforms: ['instagram', 'youtube'], ratePer1kPaise: 4500, budgetPaise: 3000000, spentPaise: 1500000, endsAt: days(11), brief: 'Clip the strongest 30–60s moments from episodes 12–18. Strong hook in the first 2 seconds.' }],
  ['mitrapod@demo.local', { title: 'Marathi episode highlights', vertical: 'regional', type: 'clipping', platforms: ['instagram'], ratePer1kPaise: 7000, budgetPaise: 1200000, spentPaise: 100000, endsAt: days(7), brief: 'Highlights from our Marathi episodes, with Marathi captions.' }],
];

const CREATORS = [
  { email: 'creator1@demo.local', name: 'Aarav (demo)', instagram: 'aarav.edits', upiId: 'aarav@okicici' },
  { email: 'creator2@demo.local', name: 'Sana (demo)', youtube: 'sanaclips' },
];

async function main() {
  await connectDb();
  const demoUsers = await User.find({ email: /@demo\.local$/ }, '_id');
  const demoBrands = await Brand.find({ ownerId: { $in: demoUsers.map((u) => u._id) } }, '_id');
  const demoCampaigns = await Campaign.find({ brandId: { $in: demoBrands.map((b) => b._id) } }, '_id');
  await Participation.deleteMany({ campaignId: { $in: demoCampaigns.map((c) => c._id) } });
  await Campaign.deleteMany({ _id: { $in: demoCampaigns.map((c) => c._id) } });
  await Brand.deleteMany({ ownerId: { $in: demoUsers.map((u) => u._id) } });
  await User.deleteMany({ email: /@demo\.local$/ });
  await Lead.deleteMany({ email: /@demo\.local$/ });

  await User.create({ email: 'admin@demo.local', name: 'Demo Admin', role: 'admin', onboarded: true });

  const brandIds = {};
  for (const b of BRANDS) {
    // Pre-assign both ids so each document is written once, already linked.
    const userId = new mongoose.Types.ObjectId();
    const brandId = new mongoose.Types.ObjectId();
    await User.create({ _id: userId, email: b.email, name: b.contactName, role: 'brand', onboarded: true, brandId });
    await Brand.create({ ...b, _id: brandId, ownerId: userId });
    brandIds[b.email] = brandId;
  }
  for (const [email, c] of CAMPAIGNS) {
    const [coverUrl, gallery] = MEDIA[c.title] || ['', []];
    await Campaign.create({ ...c, brandId: brandIds[email], rules: RULES, deliverables: DELIVERABLES, coverUrl, gallery, status: 'live', perClipCapPaise: 500000 });
  }
  for (const c of CREATORS) {
    await User.create({
      email: c.email,
      name: c.name,
      role: 'creator',
      onboarded: true,
      creator: { instagram: c.instagram || '', youtube: c.youtube || '', upiId: c.upiId || '' },
    });
  }
  await Lead.create({
    name: 'Kabir',
    company: 'SnackBox (demo)',
    email: 'kabir@demo.local',
    vertical: 'genz',
    budget: '₹10K–25K',
    message: 'Launching a new flavour next month, want campus reach in Pune.',
  });

  console.log('Seeded demo data. Sign in with any of these emails (code shows on screen in dev):');
  console.log('  admin@demo.local, campusapp@demo.local, beatlabel@demo.local, creator1@demo.local');
  await disconnectDb();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
