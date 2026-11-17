// Google sign-in through Firebase Auth. Firebase is loaded lazily so it
// doesn't slow down pages that never sign in.

// In production the server serves Firebase's sign-in pages at /__/auth on our own domain,
// so redirect sign-in works in browsers that block third-party storage (Safari, Chrome).
// Opt-in: only after https://<domain>/__/auth/handler is added to the Google OAuth client's redirect URIs.
const ownDomain =
  import.meta.env.PROD &&
  import.meta.env.VITE_AUTH_ON_OWN_DOMAIN === 'true' &&
  window.location.protocol === 'https:' &&
  !window.location.hostname.endsWith('.firebaseapp.com');

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: ownDomain ? window.location.host : import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(cfg.apiKey && import.meta.env.VITE_FIREBASE_AUTH_DOMAIN && cfg.projectId);

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

/* ---------------- YouTube connect ---------------- */

const YT_SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';
const YT_REDIRECT_KEY = 'cr_yt_redirect';

/** Error the UI can act on: `canRedirect` offers "Continue in this window". */
export class YouTubeConnectError extends Error {
  constructor(message, { canRedirect = false } = {}) {
    super(message);
    this.canRedirect = canRedirect;
  }
}

function ytProvider(sdk) {
  const provider = new sdk.GoogleAuthProvider();
  provider.addScope(YT_SCOPE);
  // Always show the account picker and the permission screen (with its YouTube checkbox).
  provider.setCustomParameters({ prompt: 'select_account consent', include_granted_scopes: 'true' });
  return provider;
}

/**
 * Asks Google for read-only YouTube access (popup) and returns a short-lived access token.
 * The server uses it once to find the creator's channel; it isn't stored.
 * Never fails silently: closed or blocked popups throw a clear, actionable error.
 */
export async function connectYouTube() {
  const { auth, sdk } = await getAuthAndSdk();
  try {
    const result = await sdk.signInWithPopup(auth, ytProvider(sdk));
    const token = sdk.GoogleAuthProvider.credentialFromResult(result)?.accessToken;
    if (!token) throw new YouTubeConnectError('Google didn’t return YouTube access. Please try again.', { canRedirect: true });
    return token;
  } catch (err) {
    if (err instanceof YouTubeConnectError) throw err;
    console.warn('[youtube connect]', err.code, err.message);
    switch (err.code) {
      case 'auth/popup-blocked':
        throw new YouTubeConnectError('Your browser blocked the Google window.', { canRedirect: true });
      case 'auth/popup-closed-by-user':
      case 'auth/cancelled-popup-request':
        throw new YouTubeConnectError(
          'The Google window closed before finishing. If you saw “Google hasn’t verified this app”, tap Advanced → Go to ClipRewards, then tick “View your YouTube account”.',
          { canRedirect: true }
        );
      case 'auth/user-cancelled':
        throw new YouTubeConnectError('You didn’t allow YouTube access. Try again and tick “View your YouTube account”.', { canRedirect: true });
      case 'auth/network-request-failed':
        throw new YouTubeConnectError(FRIENDLY[err.code]);
      case 'auth/unauthorized-domain':
      case 'auth/operation-not-allowed':
        throw new YouTubeConnectError(FRIENDLY[err.code]);
      default:
        throw new YouTubeConnectError(`YouTube connect failed (${err.code || 'unknown error'}).`, { canRedirect: true });
    }
  }
}

/** Same flow in the current window (no popup). The page reloads back here afterwards. */
export async function connectYouTubeRedirect() {
  const { auth, sdk } = await getAuthAndSdk();
  try {
    sessionStorage.setItem(YT_REDIRECT_KEY, '1');
  } catch {
    /* ignore */
  }
  await sdk.signInWithRedirect(auth, ytProvider(sdk));
}

/** After returning from connectYouTubeRedirect(): the access token, or null if this wasn't one. */
export async function completeYouTubeRedirect() {
  let pending = false;
  try {
    pending = sessionStorage.getItem(YT_REDIRECT_KEY) === '1';
    sessionStorage.removeItem(YT_REDIRECT_KEY);
  } catch {
    /* ignore */
  }
  if (!pending || !firebaseConfigured) return null;
  const { auth, sdk } = await getAuthAndSdk();
  try {
    const result = await sdk.getRedirectResult(auth);
    const token = result && sdk.GoogleAuthProvider.credentialFromResult(result)?.accessToken;
    if (!token) throw new YouTubeConnectError('Google didn’t return YouTube access. Try again and tick “View your YouTube account”.');
    return token;
  } catch (err) {
    if (err instanceof YouTubeConnectError) throw err;
    throw new YouTubeConnectError(`YouTube connect failed (${err.code || 'unknown error'}).`);
  }
}
