import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Film, Megaphone, ShieldAlert } from 'lucide-react';
import { compact, img, rupees, timeAgo } from '../../lib/format';
import { InstagramIcon, YoutubeIcon } from '../../ui/PlatformIcons';
import { useMySubmissions } from '../../components/Clips';
import { Button, Card, Chips, EmptyState, PageHeader, Skeleton, Stat, StatGrid, Status } from '../../ui';

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

const date = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

/** Every clip the creator has submitted: status, campaign, views and earnings. */
export default function MyClips() {
  const { data, isPending, error } = useMySubmissions();
  const [filter, setFilter] = useState('all');
  const subs = useMemo(() => data?.submissions ?? [], [data]);

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
      <PageHeader eyebrow="Creator" title="My clips" subtitle="Everything you’ve submitted, with live views and earnings." />

      {isPending ? (
        <Skeleton className="h-28" />
      ) : (
        <StatGrid>
          <Stat label="Clips" value={subs.length} />
          <Stat label="Total views" value={compact(totals.views)} />
          <Stat label="Earned" value={rupees(totals.earned)} tone="money" hint={totals.held > 0 ? `${rupees(totals.held)} on hold` : undefined} />
          <Stat label="In review" value={totals.review} />
        </StatGrid>
      )}

      {subs.length > 0 && (
        <div className="mt-6">
          <Chips label="Filter clips" value={filter} onChange={setFilter} options={FILTERS.map((f) => ({ ...f, label: `${f.label} ${counts[f.value] ? `· ${counts[f.value]}` : ''}`.trim() }))} />
        </div>
      )}

      <div className="mt-4 space-y-4">
        {error && <EmptyState icon={Film} title="Couldn’t load your clips">{error.message}</EmptyState>}
        {isPending && [0, 1].map((i) => <Skeleton key={i} className="h-56" />)}
        {!isPending && !error && subs.length === 0 && (
          <EmptyState
            icon={Film}
            title="No clips yet"
            action={
              <Button to="/app/campaigns">
                Find a campaign
              </Button>
            }
          >
            Join a campaign, post your Reel or Short, then paste the link on the campaign page. It shows up here with live views.
          </EmptyState>
        )}
        {!isPending && subs.length > 0 && shown.length === 0 && <p className="py-10 text-center text-sm text-muted">No clips with this status.</p>}
        {shown.map((s) => (
          <ClipCard key={s.id} s={s} />
        ))}
      </div>
    </>
  );
}

function ClipCard({ s }) {
  const [tone, label] = CLIP_STATUS[s.status] ?? CLIP_STATUS.pending;
  const Icon = s.platform === 'youtube' ? YoutubeIcon : InstagramIcon;
  const thumb = s.thumbnailUrl || img(s.campaign?.coverUrl, 400);
  const campaignState = CAMPAIGN_STATUS[s.campaign?.status];

  return (
    <Card className="flex gap-4 p-3 md:gap-5 md:p-4">
      {/* Vertical thumbnail */}
      <a href={s.url} target="_blank" rel="noreferrer" className="relative block aspect-[9/16] w-24 shrink-0 overflow-hidden rounded-2xl bg-glass-2 sm:w-32 md:w-40" aria-label="Open post">
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
      </a>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Status tone={tone}>{label}</Status>
          {s.flagged && (
            <span className="inline-flex items-center gap-1 text-xs text-warning">
              <ShieldAlert className="size-3.5" aria-hidden /> Under check
            </span>
          )}
        </div>
        <p className="mt-2 line-clamp-2 text-[15px] font-medium leading-snug">{s.title || 'Your clip'}</p>
        {s.status === 'rejected' && s.reviewNote && <p className="mt-1 text-sm text-danger">{s.reviewNote}</p>}

        {/* Campaign */}
        {s.campaign && (
          <Link to={`/app/campaigns/${s.campaign.id}`} className="mt-3 block rounded-2xl bg-glass-2 px-3 py-2.5 transition-colors hover:bg-glass-3">
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
          <Num label="Views" value={(s.views ?? 0).toLocaleString('en-IN')} className="border-x border-border" />
          <Num label="Earned" value={rupees(s.earnedPaise)} money />
        </div>
        <p className="mt-2 text-xs text-faint">
          {s.heldPaise > 0 ? `${rupees(s.heldPaise)} on 7-day hold · ` : ''}
          {s.likes != null ? `${compact(s.likes)} likes · ` : ''}
          {s.comments != null ? `${compact(s.comments)} comments · ` : ''}
          {s.lastCheckedAt ? `Views updated ${timeAgo(s.lastCheckedAt)}` : 'Views update every few hours'}
        </p>

        <div className="mt-3 flex gap-2">
          <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-glass-2 text-[13px] font-medium hover:bg-glass-3">
            <ExternalLink className="size-3.5" aria-hidden /> View post
          </a>
          {s.campaign && (
            <Link to={`/app/campaigns/${s.campaign.id}`} className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-glass-2 text-[13px] font-medium hover:bg-glass-3">
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
