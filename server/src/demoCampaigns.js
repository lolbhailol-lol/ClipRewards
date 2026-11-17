/**
 * Add or remove the demo campaigns in a real database (e.g. production on Atlas).
 * Only demo brands/campaigns tied to @demo.local emails are touched.
 *
 *   MONGODB_URI=<atlas uri> npm run demo:add      # (re)create 6 demo campaigns
 *   MONGODB_URI=<atlas uri> npm run demo:remove   # delete all demo data
 */
const mongoose = require('mongoose');
const { removeDemo, addDemoCampaigns } = require('./demoData');

async function main() {
  const action = process.argv[2];
  const uri = process.env.MONGODB_URI;
  if (!['add', 'remove'].includes(action)) throw new Error('Usage: node src/demoCampaigns.js add|remove');
  if (!uri) throw new Error('Set MONGODB_URI to the database to change');

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  console.log(`[demo] connected to ${mongoose.connection.host}/${mongoose.connection.name}`);
  const removed = await removeDemo();
  console.log('[demo] removed old demo data:', removed);
  if (action === 'add') console.log('[demo] added:', await addDemoCampaigns({ approvedOnly: true }));
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('[demo] failed:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
