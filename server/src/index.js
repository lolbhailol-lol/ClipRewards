const config = require('./config');
const { checkConfig } = require('./config');
const { connectDb, disconnectDb } = require('./db');
const { createApp } = require('./app');

async function main() {
  checkConfig();
  await connectDb();
  const app = createApp();
  const server = app.listen(config.port, () => console.log(`[api] running on http://localhost:${config.port}`));
  server.on('error', (err) => {
    console.error('[api] server error', err);
    process.exit(1);
  });
  server.on('close', () => console.log('[api] server closed'));

  // Keep Instagram tokens alive (they expire after 60 days without a refresh).
  const { refreshInstagramTokens } = require('./routes/social');
  const refresh = () => refreshInstagramTokens().catch((err) => console.warn('[social] token refresh job failed', err.message));
  setTimeout(refresh, 60 * 1000).unref();
  setInterval(refresh, 12 * 60 * 60 * 1000).unref();

  // Re-read clip views and credit earnings every 6 hours.
  const { syncSubmissions } = require('./lib/tracking');
  const sync = () => syncSubmissions().then((r) => r.checked && console.log('[tracking]', r)).catch((err) => console.warn('[tracking] sync failed', err.message));
  setTimeout(sync, 2 * 60 * 1000).unref();
  setInterval(sync, 6 * 60 * 60 * 1000).unref();

  const shutdown = async (signal) => {
    console.log(`[api] ${signal}, shutting down`);
    server.close();
    await disconnectDb().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

process.on('unhandledRejection', (err) => console.error('[api] unhandled rejection', err));

main().catch((err) => {
  console.error('[api] failed to start', err);
  process.exit(1);
});
