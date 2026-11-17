const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const config = require('./config');

// The local embedded MongoDB listens on a fixed port so a second process
// (e.g. `npm run seed` while `npm run dev` is running) can share it.
const LOCAL_PORT = Number(process.env.LOCAL_MONGO_PORT) || 27018;
const LOCAL_URI = `mongodb://127.0.0.1:${LOCAL_PORT}/cliprewards`;

// Keep the embedded MongoDB binary in one place (repo-root node_modules cache), whichever
// folder npm/jest is started from, so it's downloaded once and never re-downloaded.
process.env.MONGOMS_DOWNLOAD_DIR ||= path.resolve(__dirname, '../../node_modules/.cache/mongodb-memory-server');

let memoryServer = null;

/**
 * Builds every model's indexes before we serve traffic. Unique indexes enforce rules like
 * "one YouTube channel per user", so they must exist before the first request.
 */
async function ready() {
  require('./models/User');
  require('./models/Brand');
  require('./models/Lead');
  require('./models/Otp');
  require('./models/Campaign');
  require('./models/Participation');
  require('./models/SocialAccount');
  require('./models/InsightsCache');
  require('./models/Submission');
  require('./models/Earning');
  require('./models/Withdrawal');
  await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).init()));
  return mongoose.connection;
}

async function tryConnect(uri) {
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 1500 });
    return true;
  } catch {
    await mongoose.disconnect().catch(() => {});
    return false;
  }
}

/**
 * - MONGODB_URI set (e.g. Atlas): connect to it.
 * - inMemory (tests): throwaway in-memory DB on a random port.
 * - Otherwise: reuse the local embedded DB if it's already running, or start it,
 *   persisting to server/.data so data survives restarts.
 */
async function connectDb({ uri = config.mongoUri, inMemory = false } = {}) {
  if (uri) {
    await mongoose.connect(uri);
    return ready();
  }

  if (config.isProd) throw new Error('MONGODB_URI is required in production');
  // Dev/test only (devDependency): an embedded MongoDB.
  const { MongoMemoryServer } = require('mongodb-memory-server');
  if (inMemory) {
    memoryServer = await MongoMemoryServer.create();
    await mongoose.connect(memoryServer.getUri('cliprewards'));
    return ready();
  }

  if (await tryConnect(LOCAL_URI)) {
    console.log(`[db] Connected to the running local MongoDB on port ${LOCAL_PORT}`);
    return ready();
  }

  const dbPath = path.resolve(__dirname, '../.data');
  fs.mkdirSync(dbPath, { recursive: true });
  memoryServer = await MongoMemoryServer.create({
    instance: { dbPath, port: LOCAL_PORT, storageEngine: 'wiredTiger' },
  });
  await mongoose.connect(LOCAL_URI);
  console.log(`[db] No MONGODB_URI set, started local MongoDB on port ${LOCAL_PORT} (data in server/.data)`);
  return ready();
}

async function disconnectDb() {
  if (memoryServer && mongoose.connection.readyState === 1) {
    // Flush to disk first: stopping the embedded mongod on Windows is abrupt
    // and can otherwise drop the last writes.
    await mongoose.connection.db.admin().command({ fsync: 1 }).catch(() => {});
  }
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop({ doCleanup: false });
    memoryServer = null;
  }
}

module.exports = { connectDb, disconnectDb };
