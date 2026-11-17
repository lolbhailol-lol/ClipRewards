// Google sign-in through Firebase Auth. Firebase is loaded lazily so it
// doesn't slow down pages that never sign in.

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(cfg.apiKey && cfg.authDomain && cfg.projectId);

let authPromise = null;

async function getAuthAndSdk() {
  if (!firebaseConfigured) throw new Error('Google sign-in isn’t set up yet. Add the Firebase settings to .env.');
  if (!authPromise) {
    authPromise = Promise.all([import('firebase/app'), import('firebase/auth')]).then(([appSdk, authSdk]) => {
      const app = appSdk.getApps()[0] ?? appSdk.initializeApp(cfg);
      return { auth: authSdk.getAuth(app), sdk: authSdk };
    });
  }
  return authPromise;
}

const FRIENDLY = {
  'auth/popup-closed-by-user': null, // user closed it; not an error
  'auth/cancelled-popup-request': null,
  'auth/network-request-failed': 'Network problem. Check your connection and try again.',
  'auth/unauthorized-domain': 'This website isn’t allowed in Firebase yet. Add it under Authentication → Settings → Authorized domains.',
  'auth/operation-not-allowed': 'Google sign-in is turned off in Firebase. Enable it under Authentication → Sign-in method.',
};

/**
 * Opens Google sign-in and returns a Firebase ID token, or null if the user cancelled.
 * Falls back to a full-page redirect when the popup is blocked (common on phones).
 */
export async function signInWithGoogle() {
  const { auth, sdk } = await getAuthAndSdk();
  const provider = new sdk.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    const cred = await sdk.signInWithPopup(auth, provider);
    return cred.user.getIdToken();
  } catch (err) {
    if (err.code === 'auth/popup-blocked' || err.code === 'auth/operation-not-supported-in-this-environment') {
      await sdk.signInWithRedirect(auth, provider);
      return null; // the page navigates away
    }
    if (err.code in FRIENDLY) {
      if (FRIENDLY[err.code] === null) return null;
      throw new Error(FRIENDLY[err.code]);
    }
    console.error('[google sign-in]', err);
    throw new Error(`Google sign-in failed (${err.code || 'unknown error'}). Please try again.`);
  }
}

/** After a redirect sign-in, returns the ID token (or null if there was none). */
export async function completeRedirectSignIn() {
  if (!firebaseConfigured) return null;
  const { auth, sdk } = await getAuthAndSdk();
  const result = await sdk.getRedirectResult(auth);
  return result ? result.user.getIdToken() : null;
}

export async function firebaseSignOut() {
  if (!firebaseConfigured || !authPromise) return;
  const { auth, sdk } = await authPromise;
  await sdk.signOut(auth).catch(() => {});
}

/**
 * Asks Google for read-only YouTube access and returns a short-lived OAuth access token.
 * The server uses it once to confirm which channel is yours; it isn't stored.
 * Returns null if the user closed the popup.
 */
export async function connectYouTube() {
  const { auth, sdk } = await getAuthAndSdk();
  const provider = new sdk.GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/youtube.readonly');
  provider.setCustomParameters({ prompt: 'select_account consent' });
  try {
    const result = await sdk.signInWithPopup(auth, provider);
    const token = sdk.GoogleAuthProvider.credentialFromResult(result)?.accessToken;
    if (!token) throw new Error('Google didn’t return YouTube access. Please try again.');
    return token;
  } catch (err) {
    if (err.code in FRIENDLY) {
      if (FRIENDLY[err.code] === null) return null;
      throw new Error(FRIENDLY[err.code]);
    }
    if (err.code === 'auth/popup-blocked') throw new Error('Your browser blocked the popup. Allow popups for this site and try again.');
    if (err.message && !err.code) throw err;
    console.error('[youtube connect]', err);
    throw new Error(`YouTube connect failed (${err.code || 'unknown error'}). Please try again.`);
  }
}
