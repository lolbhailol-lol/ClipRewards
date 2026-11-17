const config = require('../config');

let auth = null;

/**
 * Verifies a Firebase ID token from the client and returns its claims.
 * Only the project ID is needed: Admin fetches Google's public keys to check the signature.
 * Uses the modular firebase-admin API (v10+); the old `admin.apps` namespace is gone in v14.
 */
async function verifyFirebaseToken(idToken) {
  if (!config.firebaseProjectId) {
    const err = new Error('Google sign-in isn’t set up on the server yet');
    err.status = 503;
    throw err;
  }
  if (!auth) {
    const { initializeApp, getApps } = require('firebase-admin/app');
    const { getAuth } = require('firebase-admin/auth');
    const app = getApps()[0] ?? initializeApp({ projectId: config.firebaseProjectId });
    auth = getAuth(app);
  }
  return auth.verifyIdToken(idToken);
}

module.exports = { verifyFirebaseToken };
