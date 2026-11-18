import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { BarChart3, Check, LayoutGrid, ShieldCheck } from 'lucide-react';
import { api } from '../../lib/api';
import { takeNext, useAuth } from '../../lib/auth';
import { firebaseConfigured } from '../../lib/firebase';
import { useYouTubeConnect } from '../../lib/useYouTubeConnect';
import { socialErrorText, startInstagramConnect } from '../../lib/social';
import { InstagramIcon, YoutubeIcon } from '../../ui/PlatformIcons';
import { Alert, Button, Spinner } from '../../ui';
import OnboardingFrame from './OnboardingFrame';

const PERKS = [
  [LayoutGrid, 'Live campaigns matched to your audience'],
  [BarChart3, 'Your views and reach, tracked automatically'],
  [ShieldCheck, 'Read-only. We can’t post or message for you'],
];

/**
 * Creator setup is one step: connect Instagram (YouTube optional, skip allowed).
 * Name comes from Google; the UPI ID is asked for at the first withdrawal.
 * Afterwards the creator lands on the live campaign feed.
 */
export default function CreatorOnboarding() {
  const { setMe } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [error, setError] = useState(null);
  const config = useQuery({ queryKey: ['auth-config'], queryFn: () => api('/auth/config'), staleTime: Infinity });

  const finish = useMutation({
    mutationFn: () => api('/onboarding/creator', { method: 'POST', body: {} }),
    onSuccess: ({ user }) => {
      setMe({ user });
      navigate(takeNext() || '/app/campaigns', { replace: true });
    },
  });

  // Back from Instagram: finish on success, show the reason otherwise.
  const handled = useRef(false);
  useEffect(() => {
    if (handled.current) return;
    const connected = params.get('connected');
    const err = params.get('social_error');
    if (!connected && !err) return;
    handled.current = true;
    if (connected) finish.mutate();
    else {
      setError(socialErrorText(params));
      setParams({}, { replace: true });
    }
  }, [params, setParams, finish]);

  const instagram = useMutation({ mutationFn: () => startInstagramConnect('/onboarding/creator'), onError: (e) => setError(e.message) });
  const yt = useYouTubeConnect({ onConnected: () => finish.mutate() });
  const youtube = { mutate: yt.connect, isPending: yt.isPending };

  if (params.get('connected') || finish.isPending) {
    return (
      <OnboardingFrame step={2} total={2} title="You’re all set">
        <Spinner label="Finishing setup" />
      </OnboardingFrame>
    );
  }

  const igReady = config.data?.instagram;
  const busy = instagram.isPending || youtube.isPending;

  return (
    <OnboardingFrame step={2} total={2} title="Connect your Instagram" subtitle="So we can show you campaigns and track your views. Takes 20 seconds.">
      <ul className="mb-6 space-y-3">
        {PERKS.map(([Icon, text]) => (
          <li key={text} className="flex items-center gap-3 text-sm">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-glass-3">
              <Icon className="size-4" strokeWidth={1.75} aria-hidden />
            </span>
            {text}
          </li>
        ))}
      </ul>

      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
      {yt.error && (
        <Alert
          tone="danger"
          title="YouTube didn’t connect"
          className="mb-4"
          action={
            yt.canRedirect && (
              <Button size="sm" variant="secondary" onClick={yt.connectInWindow}>
                Continue in this window
              </Button>
            )
          }
        >
          {yt.error.message}
        </Alert>
      )}
      {finish.error && <Alert tone="danger" className="mb-4">{finish.error.message}</Alert>}

      <Button size="lg" block arrow loading={instagram.isPending} disabled={!igReady || busy} onClick={() => instagram.mutate()}>
        {!instagram.isPending && <InstagramIcon className="size-5" />} Connect Instagram
      </Button>
      {config.data && !igReady && <p className="mt-2 text-center text-xs text-muted">Instagram connect is being set up. You can skip for now.</p>}
      <p className="mt-2 text-center text-xs text-faint">Opens Instagram in your browser: log in once if asked, then tap Allow. Needs a Creator or Business account (free to switch in Instagram settings).</p>

      <div className="my-6 flex items-center gap-3 text-xs text-faint">
        <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
      </div>

      <Button size="lg" block variant="secondary" loading={youtube.isPending} disabled={!firebaseConfigured || busy} onClick={() => youtube.mutate()}>
        {!youtube.isPending && <YoutubeIcon className="size-5" />} I post on YouTube Shorts
      </Button>

      <button
        onClick={() => finish.mutate()}
        disabled={busy}
        className="mt-6 w-full py-2 text-center text-sm text-muted hover:text-text disabled:opacity-40"
      >
        Skip for now
      </button>
      <p className="mt-1 flex items-center justify-center gap-1.5 text-center text-xs text-faint">
        <Check className="size-3.5" aria-hidden /> You can connect accounts any time from your profile.
      </p>
    </OnboardingFrame>
  );
}
