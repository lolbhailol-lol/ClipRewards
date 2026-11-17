import { api } from './api';

/**
 * Sends the browser to Instagram to connect an account. After Instagram, the server
 * returns the user to this exact site (so they stay signed in) and to `returnTo`.
 */
export async function startInstagramConnect(returnTo = '/app/profile') {
  const qs = new URLSearchParams({ origin: window.location.origin, returnTo });
  const { url } = await api(`/social/instagram/start?${qs}`);
  window.location.assign(url);
}

export const SOCIAL_ERRORS = {
  instagram_cancelled: 'You cancelled the Instagram connection.',
  instagram_expired: 'That took too long. Please try connecting Instagram again.',
  instagram_not_professional: 'Switch your Instagram to a Creator or Business account (free, in Instagram → Settings → Account type), then connect again.',
  instagram_taken: 'That Instagram account is already connected to another ClipRewards account.',
  instagram_failed: 'Couldn’t connect Instagram. Please try again.',
};
