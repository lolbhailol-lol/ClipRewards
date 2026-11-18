import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, Heart, Link2, MessageCircle, Repeat2, Bookmark, Users, X } from 'lucide-react';
import { api } from '../lib/api';
import { compact, timeAgo } from '../lib/format';
import { useYouTubeConnect } from '../lib/useYouTubeConnect';
import { socialErrorText, startInstagramConnect } from '../lib/social';
import { InstagramIcon, YoutubeIcon } from '../ui/PlatformIcons';
import { Button, Card, Field, Input, ListGroup, Notice, Skeleton, Status } from '../ui';

const PLATFORMS = {
  instagram: { name: 'Instagram', icon: InstagramIcon, unit: 'followers', why: 'Creator or Business account. Free to switch in Instagram settings.' },
  youtube: { name: 'YouTube', icon: YoutubeIcon, unit: 'subscribers', why: 'We only read your channel and video stats.' },
};

export function useSocialAccounts() {
  return useQuery({ queryKey: ['social'], queryFn: () => api('/social/accounts') });
}

/** Connect / disconnect Instagram and YouTube. Shows the result of the Instagram redirect. */
export default function SocialAccounts() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [banner, setBanner] = useState(null);
  const { data, isPending, error } = useSocialAccounts();

  // Instagram sends the browser back here with ?connected= or ?social_error=
  useEffect(() => {
    const connected = params.get('connected');
    const err = params.get('social_error');
    if (!connected && !err) return;
    setBanner(connected ? { tone: 'success', text: `${PLATFORMS[connected]?.name ?? 'Account'} connected.` } : { tone: 'danger', text: socialErrorText(params) });
    params.delete('connected');
    params.delete('social_error');
    params.delete('step');
    setParams(params, { replace: true });
    qc.invalidateQueries({ queryKey: ['social'] });
    qc.invalidateQueries({ queryKey: ['me'] });
  }, [params, setParams, qc]);

  const instagram = useMutation({ mutationFn: () => startInstagramConnect('/app/profile') });
  const yt = useYouTubeConnect({ onConnected: () => setBanner({ tone: 'success', text: 'YouTube connected.' }) });
  // Same shape as the Instagram mutation for the row buttons below.
  const youtube = { mutate: yt.connect, isPending: yt.isPending };
  const disconnect = useMutation({
    mutationFn: (platform) => api(`/social/${platform}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['social'] }),
  });

  const byPlatform = Object.fromEntries((data?.accounts ?? []).map((a) => [a.platform, a]));
  const actions = { instagram, youtube };
  const err = instagram.error || disconnect.error;

  return (
    <section>
      {banner && (
        <Notice tone={banner.tone} title={banner.text} className="mb-3" action={<button onClick={() => setBanner(null)} aria-label="Dismiss" className="text-muted hover:text-text"><X className="size-4" /></button>} />
      )}
      {err && <Notice tone="danger" className="mb-3">{err.message}</Notice>}
      {yt.error && (
        <Notice
          tone="danger"
          title="YouTube didn’t connect"
          className="mb-3"
          action={
            yt.canRedirect && (
              <Button size="sm" variant="secondary" onClick={yt.connectInWindow}>
                Continue in this window
              </Button>
            )
          }
        >
          {yt.error.message}
        </Notice>
      )}
      {error && <Notice tone="danger" className="mb-3">{error.message}</Notice>}

      <ListGroup title="Connected accounts">
        {isPending
          ? [0, 1].map((i) => <Skeleton key={i} className="m-3 h-12 rounded-2xl" />)
          : Object.entries(PLATFORMS).map(([key, p]) => {
              const acc = byPlatform[key];
              const available = data?.available?.[key];
              const m = actions[key];
              return (
                <div key={key} className="flex items-center gap-3.5 px-4 py-3.5">
                  {acc?.avatarUrl ? (
                    <img src={acc.avatarUrl} alt="" referrerPolicy="no-referrer" className="size-9 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-glass-3">
                      <p.icon className="size-[18px]" aria-hidden />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {acc ? (acc.username ? `@${acc.username}` : acc.displayName) : p.name}
                      {acc?.status === 'expired' && <Status tone="warning">Reconnect</Status>}
                    </span>
                    <span className="mt-0.5 block truncate text-[13px] text-muted">
                      {acc
                        ? `${p.name}${acc.followers != null ? ` · ${compact(acc.followers)} ${p.unit}` : ''} · connected ${timeAgo(acc.connectedAt)}`
                        : available
                          ? p.why
                          : 'Coming soon'}
                    </span>
                  </span>
                  {acc && acc.status !== 'expired' ? (
                    <Button size="sm" variant="ghost" loading={disconnect.isPending && disconnect.variables === key} onClick={() => disconnect.mutate(key)}>
                      Disconnect
                    </Button>
                  ) : (
                    <Button size="sm" disabled={!available} loading={m.isPending} onClick={() => m.mutate()}>
                      {acc ? 'Reconnect' : 'Connect'}
                    </Button>
                  )}
                </div>
              );
            })}
      </ListGroup>
      <p className="mt-2 px-1 text-[13px] text-faint">Instagram opens in your browser: log in once if asked, then tap Allow. We read views and engagement only and can’t post, comment or message from your account.</p>
    </section>
  );
}

const STAT_ROWS = [
  ['views', 'Views', Eye],
  ['reach', 'Reach', Users],
  ['likes', 'Likes', Heart],
  ['comments', 'Comments', MessageCircle],
  ['shares', 'Shares', Repeat2],
  ['saves', 'Saves', Bookmark],
];

/** Paste a Reel/Short link → confirms it's yours and shows live stats. */
export function CheckPost() {
  const [url, setUrl] = useState('');
  const check = useMutation({ mutationFn: () => api('/social/check', { method: 'POST', body: { url } }) });
  const r = check.data;

  return (
    <section>
      <h2 className="mb-2.5 px-1 text-[15px] font-semibold">Check a post’s views</h2>
      <Card className="p-4 md:p-5">
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            check.mutate();
          }}
        >
          <Field label="Reel or Shorts link" className="flex-1">
            {(p) => (
              <div className="relative">
                <Link2 className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
                <Input {...p} type="url" inputMode="url" required placeholder="https://www.instagram.com/reel/…" className="pl-10" value={url} onChange={(e) => setUrl(e.target.value)} />
              </div>
            )}
          </Field>
          <Button type="submit" loading={check.isPending}>
            Check
          </Button>
        </form>

        {check.error && <Notice tone="danger" className="mt-4">{check.error.message}</Notice>}

        {r && (
          <div className="mt-5">
            <div className="flex items-center gap-3">
              {r.post.thumbnailUrl ? (
                <img src={r.post.thumbnailUrl} alt="" className="size-14 shrink-0 rounded-xl object-cover" />
              ) : (
                <span className="stripes size-14 shrink-0 rounded-xl" />
              )}
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-[13px] text-muted">
                  {r.platform === 'youtube' ? <YoutubeIcon className="size-3.5" /> : <InstagramIcon className="size-3.5" />}
                  Verified on your account
                </p>
                <p className="truncate text-sm font-medium">{r.post.title || 'Untitled post'}</p>
                {r.platform === 'youtube' && r.post.likelyShort === false && <p className="text-xs text-warning">This looks longer than a Short (over 3 minutes).</p>}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {STAT_ROWS.filter(([k]) => r.stats[k] != null).map(([k, label, Icon]) => (
                <div key={k} className="rounded-2xl bg-glass-2 p-3 shadow-[inset_0_1px_0_var(--glass-hi)]">
                  <Icon className="size-4 text-muted" aria-hidden />
                  <p className="mt-2 font-mono text-lg font-medium tabular-nums">{compact(r.stats[k])}</p>
                  <p className="label mt-0.5">{label}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-faint">
              Checked {timeAgo(r.checkedAt)}. {r.note}
            </p>
          </div>
        )}
      </Card>
    </section>
  );
}
