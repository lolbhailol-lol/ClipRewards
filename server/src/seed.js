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
const { removeDemo, addDemoCampaigns } = require('./demoData');

const CREATORS = [
  { email: 'creator1@demo.local', name: 'Aarav (demo)', instagram: 'aarav.edits', upiId: 'aarav@okicici' },
  { email: 'creator2@demo.local', name: 'Sana (demo)', youtube: 'sanaclips' },
];

async function main() {
  await connectDb();
  await removeDemo();
  await Lead.deleteMany({ email: /@demo\.local$/ });

  await User.create({ email: 'admin@demo.local', name: 'Demo Admin', role: 'admin', onboarded: true });

  await addDemoCampaigns();
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
