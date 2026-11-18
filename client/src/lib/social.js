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

const STEP_NAMES = { no_code: 'no code from Instagram', user: 'account check', code: 'code exchange', token: 'token', profile: 'reading your profile', save: 'saving' };

/** Error text for ?social_error=…&step=… (the step helps support find the cause). */
export function socialErrorText(params) {
  const err = params.get('social_error');
  const text = SOCIAL_ERRORS[err] ?? SOCIAL_ERRORS.instagram_failed;
  const step = params.get('step');
  return step && STEP_NAMES[step] ? `${text} (Failed at: ${STEP_NAMES[step]})` : text;
}
