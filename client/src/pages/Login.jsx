import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { homeFor, takeNext, useAuth } from '../lib/auth';
import { completeRedirectSignIn, firebaseConfigured, preloadFirebase, signInWithGoogle } from '../lib/firebase';
import BottomNav, { usePublicNav } from '../layouts/BottomNav';
import { Alert, Button, Card, Field, Input, Logo, Spinner } from '../ui';

function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export default function Login() {
  const { user, signIn } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const nav = usePublicNav();
  const [devOpen, setDevOpen] = useState(false);
  const role = params.get('role');

  // Remember which button brought them here, so "Choose account type" is preselected.
  useEffect(() => {
    if (role === 'creator' || role === 'brand') {
      try {
        sessionStorage.setItem('cr_intended_role', role);
      } catch {
        /* ignore */
      }
    }
  }, [role]);

  const authConfig = useQuery({ queryKey: ['auth-config'], queryFn: () => api('/auth/config'), staleTime: Infinity });

  const finish = (data) => {
    signIn(data);
    const ready = data.user.role === 'creator' && data.user.onboarded;
    navigate((ready && takeNext()) || homeFor(data.user), { replace: true });
  };

  const google = useMutation({
    // Gets a promise for the Google ID token (started in the tap itself, see onClick).
    mutationFn: async (pendingToken) => {
      const idToken = await pendingToken;
      if (!idToken) return null; // cancelled, or the page is redirecting
      return api('/auth/firebase', { method: 'POST', body: { idToken } });
    },
    onSuccess: (data) => data && finish(data),
  });

  // Coming back from a redirect sign-in (phones where popups are blocked).
  const checkedRedirect = useRef(false);
  useEffect(() => {
    if (checkedRedirect.current || !firebaseConfigured) return;
    checkedRedirect.current = true;
    preloadFirebase();
    google.mutate(completeRedirectSignIn());
  }, [google]);

  if (user) return <Navigate to={homeFor(user)} replace />;

  const isBrand = role === 'brand';
  const googleReady = firebaseConfigured && authConfig.data?.google !== false;

  return (
    <div className="pb-tabbar flex min-h-dvh flex-col items-center justify-center px-4 py-10 md:pb-10">
      <Link to="/" className="mb-10" aria-label="CreatorPerks home">
        <Logo />
      </Link>

      <Card className="w-full max-w-sm p-6 md:p-7">
        <h1 className="text-[22px] font-semibold leading-tight">{isBrand ? 'Launch your first campaign' : 'Welcome to CreatorPerks'}</h1>
        <p className="mt-2 text-sm text-muted">Continue with your Google account. New here? Your account is created automatically.</p>

        <Button
          size="lg"
          variant="secondary"
          block
          className="mt-6 !bg-white !text-[#1f1f1f] hover:!bg-zinc-100"
          loading={google.isPending}
          disabled={!googleReady}
          onClick={() => google.mutate(signInWithGoogle())}
        >
          {!google.isPending && <GoogleG />} Continue with Google
        </Button>

        {google.error && <Alert tone="danger" className="mt-4">{google.error.message}</Alert>}
        {!googleReady && !authConfig.isPending && (
          <Alert tone="warning" title="Google sign-in isn’t set up yet" className="mt-4">
            Add the Firebase settings to <span className="font-mono">.env</span> and restart the app.
          </Alert>
        )}

        <p className="mt-6 flex items-start gap-2 text-xs text-muted">
          <ShieldCheck className="mt-px size-4 shrink-0" aria-hidden />
          We only use your name, email and photo. We never post anything for you.
        </p>

        {authConfig.data?.devEmail && (
          <div className="mt-6 border-t border-border pt-4">
            {devOpen ? (
              <DevEmailLogin onDone={finish} onClose={() => setDevOpen(false)} />
            ) : (
              <button onClick={() => setDevOpen(true)} className="w-full text-center text-xs text-faint hover:text-muted">
                Dev only: sign in with an email code
              </button>
            )}
          </div>
        )}
      </Card>

      <p className="mt-6 max-w-sm text-center text-xs text-faint">
        By continuing you agree to our <Link to="/terms" className="underline underline-offset-2">Terms</Link> and{' '}
        <Link to="/privacy" className="underline underline-offset-2">Privacy Policy</Link>.
      </p>
      <BottomNav items={nav} />
    </div>
  );
}

/** Local development only: sign in as the seeded demo accounts without Google. */
function DevEmailLogin({ onDone, onClose }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const request = useMutation({ mutationFn: () => api('/auth/otp/request', { method: 'POST', body: { email } }) });
  const verify = useMutation({
    mutationFn: () => api('/auth/otp/verify', { method: 'POST', body: { email, code } }),
    onSuccess: onDone,
  });

  if (request.isPending) return <Spinner />;

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (request.isSuccess) verify.mutate();
        else request.mutate();
      }}
    >
      <button type="button" onClick={onClose} className="inline-flex items-center gap-1 text-xs text-muted hover:text-text">
        <ArrowLeft className="size-3.5" aria-hidden /> Back
      </button>
      {!request.isSuccess ? (
        <Field label="Email">
          {(p) => <Input {...p} type="email" required autoFocus placeholder="creator1@demo.local" value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
      ) : (
        <>
          <p className="text-xs text-muted">
            Dev code: <span className="font-mono font-bold text-text">{request.data.devCode}</span>
          </p>
          <Field label="6-digit code">
            {(p) => (
              <Input
                {...p}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                autoFocus
                className="text-center font-mono tracking-[0.4em]"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            )}
          </Field>
        </>
      )}
      {(request.error || verify.error) && <Alert tone="danger">{(request.error || verify.error).message}</Alert>}
      <Button type="submit" size="sm" block loading={verify.isPending}>
        {request.isSuccess ? 'Sign in' : 'Get code'}
      </Button>
    </form>
  );
}
