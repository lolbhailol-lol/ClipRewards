import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownToLine, CheckCircle2, ExternalLink, Eye, Film, Megaphone, ShieldAlert, Upload, XCircle } from 'lucide-react';
import { compact, img, rupees, timeAgo } from '../../lib/format';
import { InstagramIcon, YoutubeIcon } from '../../ui/PlatformIcons';
import { checkProblem, useMySubmissions, useWallet } from '../../components/Clips';
import { Button, Card, Chips, EmptyState, Notice, PageHeader, Segmented, Skeleton, Stat, StatGrid, Status, Tag, cx } from '../../ui';

const CLIP_STATUS = {
  pending: ['warning', 'In review'],
  approved: ['success', 'Approved'],
  rejected: ['danger', 'Rejected'],
  removed: ['neutral', 'Removed'],
};
const CAMPAIGN_STATUS = { live: 'Live', paused: 'Paused', ended: 'Ended', completed: 'Ended' };

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'In review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

// "18 Nov" this year, "18 Nov 25" for older posts (fits the narrow phone column).
const date = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  const sameYear = dt.getFullYear() === new Date().getFullYear();
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: '2-digit' }) });
};

/* ---------------- Example dashboard (shown until the creator has clips) ---------------- */

const ago = (h) => new Date(Date.now() - h * 3600 * 1000).toISOString();
const U = (id) => `https://images.unsplash.com/photo-${id}`;
const EXAMPLE_SUBS = [
  {
    id: 'ex1', platform: 'instagram', status: 'approved', title: 'Hostel room tour, but every snack is a plot twist #ad',
    thumbnailUrl: img(U('1523240795612-9a054b0db644'), 400), views: 48210, likes: 3120, comments: 88, earnedPaise: 289200, heldPaise: 90000,
    publishedAt: ago(150), createdAt: ago(148), reviewedAt: ago(140), lastCheckedAt: ago(2),
    campaign: { title: 'New masala flavour launch', brand: 'SnackBox', status: 'live' },
  },
  {
    id: 'ex2', platform: 'youtube', status: 'approved', title: 'The 0:42 hook, but make it a dance trend #shorts',
    thumbnailUrl: img(U('1493225457124-a3eb161ffa5f'), 400), views: 124500, likes: 9800, comments: 214, earnedPaise: 500000, heldPaise: 0,
    publishedAt: ago(400), createdAt: ago(398), reviewedAt: ago(380), lastCheckedAt: ago(5),
    campaign: { title: '“Neon Raat” single release', brand: 'Beat Label', status: 'live' },
  },
  {
    id: 'ex3', platform: 'instagram', status: 'pending', title: 'Founder said this at 2am and it changed how I study',
    thumbnailUrl: img(U('1478737270239-2f02b77fc618'), 400), views: 2498, likes: 140, comments: 9, earnedPaise: 0, heldPaise: 0,
    publishedAt: ago(20), createdAt: ago(18), lastCheckedAt: ago(1),
    campaign: { title: 'Founder stories: best moments', brand: 'Mitra Podcast', status: 'live' },
  },
];
const EXAMPLE_ACTIVITY = [
  { id: 'a1', kind: 'views', title: 'Views came in', detail: '48,210 views · New masala flavour launch', amountPaise: 90000, onHold: true, at: ago(2) },
  { id: 'a2', kind: 'submitted', title: 'Clip submitted', detail: 'Founder stories: best moments', at: ago(18) },
  { id: 'a3', kind: 'payout', title: 'Payout sent', detail: 'To you@okicici · ref 431992018822', amountPaise: 400000, status: 'paid', at: ago(30) },
  { id: 'a4', kind: 'views', title: 'Views came in', detail: '31,400 views · New masala flavour launch', amountPaise: 199200, at: ago(96) },
  { id: 'a5', kind: 'approved', title: 'Clip approved', detail: 'New masala flavour launch', at: ago(140) },
  { id: 'a6', kind: 'views', title: 'Views came in', detail: '1,24,500 views · “Neon Raat” single release', amountPaise: 500000, at: ago(200) },
  { id: 'a7', kind: 'approved', title: 'Clip approved', detail: '“Neon Raat” single release', at: ago(380) },
  { id: 'a8', kind: 'submitted', title: 'Clip submitted', detail: '“Neon Raat” single release', at: ago(398) },
];

/** One timeline from clip events (submitted / reviewed) and wallet events (views credited / payouts). */
function buildActivity(subs, wallet = []) {
  const ev = [];
  for (const s of subs) {
    const t = s.campaign?.title || 'Campaign';
    ev.push({ id: `${s.id}:sub`, kind: 'submitted', title: 'Clip submitted', detail: t, at: s.createdAt });
    if (s.reviewedAt && s.status === 'approved') ev.push({ id: `${s.id}:ok`, kind: 'approved', title: 'Clip approved', detail: t, at: s.reviewedAt });
    if (s.reviewedAt && s.status === 'rejected') ev.push({ id: `${s.id}:no`, kind: 'rejected', title: 'Clip rejected', detail: s.reviewNote || t, at: s.reviewedAt });
  }
  for (const a of wallet) {
    if (a.kind === 'earning') ev.push({ id: a.id, kind: 'views', title: 'Views came in', detail: `${a.detail} · ${a.title}`, amountPaise: a.amountPaise, onHold: a.onHold, at: a.at });
    else if (a.kind === 'reversal') ev.push({ id: a.id, kind: 'reversal', title: 'Earnings adjusted', detail: a.detail || a.title, amountPaise: a.amountPaise, at: a.at });
    else if (a.kind === 'withdrawal') {
      const title = a.status === 'paid' ? 'Payout sent' : a.status === 'rejected' ? 'Payout not sent' : 'Payout requested';
      ev.push({ id: a.id, kind: 'payout', title, detail: `${a.title.replace('Withdrawal to', 'To')} · ${a.detail}`, amountPaise: Math.abs(a.amountPaise), status: a.status, at: a.at });
    }
  }
  return ev.sort((x, y) => new Date(y.at) - new Date(x.at));
}

/* ---------------- Page ---------------- */

/** Every clip the creator has submitted (status, campaign, views, earnings) plus an activity timeline. */
export default function MyClips() {
  const { data, isPending, error } = useMySubmissions();
  const wallet = useWallet();
  const [filter, setFilter] = useState('all');
  const [tab, setTab] = useState('clips');

  const real = useMemo(() => data?.submissions ?? [], [data]);
  const example = !isPending && !error && real.length === 0;
  const subs = example ? EXAMPLE_SUBS : real;
  const activity = useMemo(() => (example ? EXAMPLE_ACTIVITY : buildActivity(real, wallet.data?.activity)), [example, real, wallet.data]);

  const totals = useMemo(
    () =>
      subs.reduce(
        (t, s) => ({
          views: t.views + (s.views || 0),
          earned: t.earned + (s.earnedPaise || 0),
          held: t.held + (s.heldPaise || 0),
          review: t.review + (s.status === 'pending' ? 1 : 0),
        }),
        { views: 0, earned: 0, held: 0, review: 0 }
      ),
    [subs]
  );
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.value, f.value === 'all' ? subs.length : subs.filter((s) => s.status === f.value).length])), [subs]);
  const shown = filter === 'all' ? subs : subs.filter((s) => s.status === filter);

  return (
    <>
      <PageHeader eyebrow="Creator" title="My clips" subtitle="Everything you’ve submitted, with live views, earnings and payouts." />

      {example && (
        <Notice
          tone="neutral"
          className="mb-4"
          title="This is an example dashboard"
          action={
            <Button size="sm" to="/app/campaigns">
              Find a campaign
            </Button>
          }
        >
          Submit your first clip and your own clips, views and payouts show up here.
        </Notice>
      )}

      {isPending ? (
        <Skeleton className="h-28" />
      ) : (
        <StatGrid className={cx(example && 'opacity-80')}>
          <Stat label="Clips" value={subs.length} />
          <Stat label="Total views" value={compact(totals.views)} />
          <Stat label="Earned" value={rupees(totals.earned)} tone="money" hint={totals.held > 0 ? `${rupees(totals.held)} on hold` : undefined} />
          <Stat label="In review" value={totals.review} />
        </StatGrid>
      )}

      {error && <EmptyState icon={Film} title="Couldn’t load your clips" className="mt-4">{error.message}</EmptyState>}
      {isPending && <div className="mt-6 space-y-4">{[0, 1].map((i) => <Skeleton key={i} className="h-56" />)}</div>}

      {!isPending && !error && (
        <>
          <Segmented
            label="View"
            className="mt-6 flex w-full sm:w-auto"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'clips', label: 'Clips', count: subs.length },
              { value: 'activity', label: 'Activity', count: activity.length },
            ]}
          />

          {tab === 'clips' ? (
            <>
              <div className="mt-4">
                <Chips label="Filter clips" value={filter} onChange={setFilter} options={FILTERS.map((f) => ({ ...f, label: `${f.label}${counts[f.value] ? ` · ${counts[f.value]}` : ''}` }))} />
              </div>
              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                {shown.length === 0 && <p className="py-10 text-center text-sm text-muted xl:col-span-2">No clips with this status.</p>}
                {shown.map((s) => (
                  <ClipCard key={s.id} s={s} example={example} />
                ))}
              </div>
            </>
          ) : (
            <ActivityFeed items={activity} example={example} />
          )}
        </>
      )}
    </>
  );
}

/* ---------------- Activity ---------------- */

const KIND = {
  submitted: { icon: Upload, tone: 'text-muted' },
  approved: { icon: CheckCircle2, tone: 'text-success' },
  rejected: { icon: XCircle, tone: 'text-danger' },
  views: { icon: Eye, tone: 'text-primary-text' },
  reversal: { icon: ShieldAlert, tone: 'text-warning' },
  payout: { icon: ArrowDownToLine, tone: 'text-c-money' },
};

function ActivityFeed({ items, example }) {
  if (!items.length) return <EmptyState icon={Film} title="No activity yet" className="mt-4">Submitted clips, views and payouts show up here.</EmptyState>;
  return (
    <div className="glass mt-4 divide-y divide-border overflow-hidden rounded-3xl">
      {items.map((a) => {
        const k = KIND[a.kind] ?? KIND.submitted;
        const Icon = k.icon;
        return (
          <div key={a.id} className="flex items-center gap-3 px-4 py-3.5">
            <span className={cx('grid size-10 shrink-0 place-items-center rounded-full bg-glass-2', k.tone)}>
              <Icon className="size-[18px]" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-2 text-sm font-medium">
                {a.title}
                {a.onHold && <span className="text-[11px] font-normal text-warning">On hold</span>}
                {a.kind === 'payout' && a.status === 'requested' && <span className="text-[11px] font-normal text-warning">Processing</span>}
              </p>
              <p className="truncate text-xs text-muted">{a.detail}</p>
            </div>
            <div className="shrink-0 text-right">
              {a.amountPaise != null && (
                <p className={cx('font-mono text-sm font-medium tabular-nums', a.amountPaise < 0 ? 'text-danger' : 'text-c-money')}>
                  {a.amountPaise < 0 ? '−' : a.kind === 'payout' ? '' : '+'}
                  {rupees(Math.abs(a.amountPaise))}
                </p>
              )}
              <p className="text-[11px] text-faint">{example ? 'Example' : timeAgo(a.at)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Clip card ---------------- */

function ClipCard({ s, example }) {
  const [tone, label] = CLIP_STATUS[s.status] ?? CLIP_STATUS.pending;
  const Icon = s.platform === 'youtube' ? YoutubeIcon : InstagramIcon;
  const thumb = s.thumbnailUrl || img(s.campaign?.coverUrl, 400);
  const campaignState = CAMPAIGN_STATUS[s.campaign?.status];
  const campaignTo = s.campaign?.id ? `/app/campaigns/${s.campaign.id}` : '/app/campaigns';
  // Example cards have no real post to open.
  const PostLink = example ? 'div' : 'a';
  const postProps = example ? {} : { href: s.url, target: '_blank', rel: 'noreferrer', 'aria-label': 'Open post' };

  return (
    <Card className="flex gap-4 p-3 md:gap-5 md:p-4">
      {/* Vertical thumbnail */}
      <PostLink {...postProps} className="relative block aspect-[9/16] w-24 shrink-0 overflow-hidden rounded-2xl bg-glass-2 sm:w-32 md:w-40">
        {thumb ? (
          <img src={thumb} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover" />
        ) : (
          <span className="stripes grid size-full place-items-center">
            <Icon className="size-6 text-muted" />
          </span>
        )}
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
          <Icon className="size-3" /> {s.platform === 'youtube' ? 'YouTube' : 'Instagram'}
        </span>
      </PostLink>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Status tone={tone}>{label}</Status>
          {example && <Tag>Example</Tag>}
          {s.flagged && (
            <span className="inline-flex items-center gap-1 text-xs text-warning">
              <ShieldAlert className="size-3.5" aria-hidden /> Under check
            </span>
          )}
        </div>
        <p className="mt-2 line-clamp-2 text-[15px] font-medium leading-snug">{s.title || 'Your clip'}</p>
        {s.status === 'rejected' && s.reviewNote && <p className="mt-1 text-sm text-danger">{s.reviewNote}</p>}
        {checkProblem(s) && <p className="mt-2 rounded-2xl bg-warning-soft px-3 py-2 text-[13px] text-warning">{checkProblem(s)}</p>}

        {/* Campaign */}
        {s.campaign && (
          <Link to={campaignTo} className="mt-3 block rounded-2xl bg-glass-2 px-3 py-2.5 transition-colors hover:bg-glass-3">
            <span className="flex items-center justify-between gap-2">
              <span className="label inline-flex items-center gap-1.5">
                <Megaphone className="size-3.5" aria-hidden /> Campaign
              </span>
              {campaignState && <span className="text-[11px] text-muted">{campaignState}</span>}
            </span>
            <span className="mt-1 block truncate text-sm font-medium">{s.campaign.title}</span>
            {s.campaign.brand && <span className="block truncate text-xs text-muted">{s.campaign.brand}</span>}
          </Link>
        )}

        {/* Numbers */}
        <div className="mt-3 grid grid-cols-3 overflow-hidden rounded-2xl bg-glass-2">
          <Num label="Posted" value={date(s.publishedAt || s.createdAt)} />
          <Num label="Views" value={(s.views ?? 0) < 100000 ? (s.views ?? 0).toLocaleString('en-IN') : compact(s.views)} className="border-x border-border" />
          <Num label="Earned" value={rupees(s.earnedPaise)} money />
        </div>
        <p className="mt-2 text-xs text-faint">
          {s.heldPaise > 0 ? `${rupees(s.heldPaise)} on 7-day hold · ` : ''}
          {s.likes != null ? `${compact(s.likes)} likes · ` : ''}
          {s.comments != null ? `${compact(s.comments)} comments · ` : ''}
          {s.lastCheckedAt ? `Views updated ${timeAgo(s.lastCheckedAt)}` : 'Views update every few hours'}
        </p>

        <div className="mt-3 flex gap-2">
          {!example && (
            <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-glass-2 text-[13px] font-medium hover:bg-glass-3">
              <ExternalLink className="size-3.5" aria-hidden /> View post
            </a>
          )}
          {s.campaign && (
            <Link to={campaignTo} className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-glass-2 text-[13px] font-medium hover:bg-glass-3">
              <Megaphone className="size-3.5" aria-hidden /> Campaign
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}

function Num({ label, value, money, className = '' }) {
  return (
    <div className={`min-w-0 p-2.5 md:p-3 ${className}`}>
      <p className="label">{label}</p>
      <p className={`mt-0.5 truncate font-mono text-[13px] font-medium tabular-nums md:text-sm ${money ? 'text-c-money' : ''}`}>{value}</p>
    </div>
  );
}
