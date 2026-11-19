import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { socialErrorText } from '../lib/social';
import { Notice } from '../ui';

const NAMES = { instagram: 'Instagram', youtube: 'YouTube' };

/**
 * Instagram sends the browser back to whichever page the creator started on
 * (home, a campaign, profile) with ?connected= or ?social_error=. This shows the result
 * on any page in the app and refreshes the connected accounts.
 */
export default function SocialReturn() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [banner, setBanner] = useState(null);

  useEffect(() => {
    const connected = params.get('connected');
    const err = params.get('social_error');
    if (!connected && !err) return;
    setBanner(connected ? { tone: 'success', text: `${NAMES[connected] ?? 'Account'} connected.` } : { tone: 'danger', text: socialErrorText(params) });
    const next = new URLSearchParams(params);
    ['connected', 'social_error', 'step'].forEach((k) => next.delete(k));
    setParams(next, { replace: true });
    qc.invalidateQueries({ queryKey: ['social'] });
    qc.invalidateQueries({ queryKey: ['me'] });
  }, [params, setParams, qc]);

  // Success fades on its own; errors stay until dismissed so they can be read or screenshotted.
  useEffect(() => {
    if (banner?.tone !== 'success') return undefined;
    const t = setTimeout(() => setBanner(null), 5000);
    return () => clearTimeout(t);
  }, [banner]);

  if (!banner) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-4" role="status" aria-live="polite">
      <Notice
        tone={banner.tone}
        title={banner.text}
        className="pointer-events-auto w-full max-w-md shadow-2xl glass-solid"
        action={
          <button onClick={() => setBanner(null)} aria-label="Dismiss" className="text-muted hover:text-text">
            <X className="size-4" />
          </button>
        }
      />
    </div>
  );
}
