import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, ExternalLink, RefreshCw } from 'lucide-react';
import { api } from '../../lib/api';
import { compact, timeAgo } from '../../lib/format';
import { InstagramIcon, YoutubeIcon } from '../../ui/PlatformIcons';
import BarChart from '../../components/BarChart';
import { useSocialAccounts } from '../../components/SocialAccounts';
import { Avatar, Button, Card, Chips, EmptyState, Notice, PageHeader, Segmented, Skeleton, Stat, StatGrid, cx, toneClass } from '../../ui';

const RANGES = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
];

const TILES = {
  instagram: [
    ['views', 'Views'],
    ['reach', 'Reach'],
    ['engaged', 'Engaged'],
    ['interactions', 'Interactions'],
  ],
  youtube: [
    ['views', 'Views'],
    ['likes', 'Likes'],
    ['comments', 'Comments'],
    ['shorts', 'Shorts posted'],
  ],
};

export function useInsights(platform, days, enabled = true) {
  return useQuery({
    queryKey: ['insights', platform, days],
    queryFn: () => api(`/social/${platform}/insights?days=${days}`),
    enabled,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export default function Insights() {
  const accounts = useSocialAccounts();
  const connected = new Set((accounts.data?.accounts ?? []).map((a) => a.platform));
  const [platform, setPlatform] = useState(null);
  const [days, setDays] = useState(30);
  const current = platform ?? (connected.has('instagram') || !connected.has('youtube') ? 'instagram' : 'youtube');

  return (
    <>
      <PageHeader eyebrow="Creator" title="Insights" subtitle="How your Reels and Shorts are performing." />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented
          label="Platform"
          value={current}
          onChange={setPlatform}
          className="w-full sm:w-auto"
          options={[
            { value: 'instagram', label: 'Instagram' },
            { value: 'youtube', label: 'YouTube' },
          ]}
        />
        <Chips label="Date range" options={RANGES} value={days} onChange={setDays} />
      </div>

      {accounts.isPending ? (
        <Skeleton className="h-64" />
      ) : !connected.has(current) ? (
        <EmptyState
          icon={current === 'instagram' ? InstagramIcon : YoutubeIcon}
          title={`Connect ${current === 'instagram' ? 'Instagram' : 'YouTube'} to see insights`}
          action={<Button to="/app/profile">Connect account</Button>}
        >
          {current === 'instagram'
            ? 'Views, reach and engagement for your account and every Reel, updated from Instagram.'
            : 'Views, likes and comments for your Shorts, straight from YouTube.'}
        </EmptyState>
      ) : (
        <Dashboard platform={current} days={days} />
      )}
    </>
  );
}

function Dashboard({ platform, days }) {
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const { data, isPending, error } = useInsights(platform, days);

  async function refresh() {
    setRefreshing(true);
    try {
      const fresh = await api(`/social/${platform}/insights?days=${days}&refresh=1`);
      qc.setQueryData(['insights', platform, days], fresh);
    } catch {
      /* keep showing what we have */
    } finally {
      setRefreshing(false);
    }
  }

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-28" />
        <Skeleton className="h-56" />
      </div>
    );
  }
  if (error) {
    return (
      <Notice tone="danger" title="Couldn’t load insights" action={error.status === 400 ? <Button to="/app/profile" size="sm" variant="secondary">Reconnect</Button> : null}>
        {error.message}
      </Notice>
    );
  }

  const { account, totals, series, posts, notes } = data;
  const seriesKey = platform === 'instagram' && series.some((s) => s.reach) ? 'reach' : 'views';
  const chart = series.map((s) => ({ date: s.date, value: s[seriesKey] }));

  return (
    <div className="space-y-6">
      {/* Account header */}
      <Card className="flex items-center gap-3.5 p-4">
        <Avatar name={account.displayName || account.username} src={account.avatarUrl} className="size-12" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{account.username ? `@${account.username}` : account.displayName}</p>
          <p className="text-[13px] text-muted">
            {account.followers != null ? `${compact(account.followers)} ${platform === 'instagram' ? 'followers' : 'subscribers'}` : 'Followers hidden'}
            {account.mediaCount != null && ` · ${compact(account.mediaCount)} posts`}
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={refresh} loading={refreshing} aria-label="Refresh insights">
          {!refreshing && <RefreshCw className="size-3.5" aria-hidden />}
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </Card>

      {/* Totals */}
      <StatGrid>
        {TILES[platform].map(([k, label]) => (
          <Stat key={k} label={label} value={totals[k] != null ? compact(totals[k]) : '—'} />
        ))}
      </StatGrid>

      {platform === 'instagram' && (
        <div className="grid grid-cols-4 gap-2">
          {[
            ['likes', 'Likes'],
            ['comments', 'Comments'],
            ['shares', 'Shares'],
            ['saves', 'Saves'],
          ].map(([k, label]) => (
            <div key={k} className="rounded-2xl bg-glass p-3 text-center shadow-[inset_0_1px_0_var(--glass-hi)]">
              <p className={cx("font-mono text-base font-medium tabular-nums", toneClass(label))}>{totals[k] != null ? compact(totals[k]) : '—'}</p>
              <p className="label mt-0.5 !text-[10px]">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Daily chart */}
      <Card className="p-4 md:p-5">
        <BarChart data={chart} label={seriesKey === 'reach' ? 'Accounts reached' : 'Views on posts published'} />
      </Card>

      {/* Posts */}
      <section>
        <h2 className="mb-2.5 px-1 text-[15px] font-semibold">
          Top {platform === 'instagram' ? 'posts' : 'videos'} <span className="font-normal text-muted">· last {days} days</span>
        </h2>
        {posts.length === 0 ? (
          <EmptyState icon={BarChart3} title="No posts in this period">
            Post a Reel or Short and it will show up here with its views.
          </EmptyState>
        ) : (
          <div className="glass divide-y divide-border overflow-hidden rounded-3xl">
            {posts.map((p, i) => (
              <PostRow key={p.id} post={p} rank={i + 1} platform={platform} />
            ))}
          </div>
        )}
      </section>

      <div className="space-y-1 px-1 text-xs text-faint">
        <p>Updated {timeAgo(data.fetchedAt)}{data.cached ? ' (cached)' : ''}{data.stale ? ' · showing older data, the platform didn’t respond' : ''}.</p>
        {notes?.map((n) => (
          <p key={n}>{n}</p>
        ))}
      </div>
    </div>
  );
}

function PostRow({ post: p, rank, platform }) {
  const stats = [
    ['views', 'views'],
    ['likes', 'likes'],
    ['comments', 'comments'],
    ...(platform === 'instagram' ? [['shares', 'shares']] : []),
  ].filter(([k]) => p[k] != null);
  return (
    <a href={p.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-3 py-3 hover:bg-glass-2 md:px-4">
      <span className="w-5 shrink-0 text-center font-mono text-xs text-faint">{rank}</span>
      {p.thumbnailUrl ? (
        <img src={p.thumbnailUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-16 w-12 shrink-0 rounded-xl object-cover" />
      ) : (
        <span className="stripes h-16 w-12 shrink-0 rounded-xl" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{p.title || 'Untitled'}</span>
        <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-xs text-muted tabular-nums">
          {stats.map(([k, label]) => (
            <span key={k}>
              <span className={cx(k === 'views' && 'text-text')}>{compact(p[k])}</span> {label}
            </span>
          ))}
        </span>
        <span className="mt-1 block text-[11px] text-faint">
          {new Date(p.publishedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          {p.engagementRate != null && ` · ${p.engagementRate}% engagement`}
          {p.avgWatchTimeMs != null && ` · ${(p.avgWatchTimeMs / 1000).toFixed(1)}s avg watch`}
          {platform === 'youtube' && p.likelyShort === false && ' · long video'}
        </span>
      </span>
      <ExternalLink className="size-4 shrink-0 text-faint" aria-hidden />
    </a>
  );
}
