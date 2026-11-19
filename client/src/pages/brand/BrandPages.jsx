import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BadgeCheck,
  Building2,
  CheckCircle2,
  Circle,
  CircleHelp,
  CreditCard,
  ExternalLink,
  Film,
  Globe,
  LogOut,
  Mail,
  Megaphone,
  Moon,
  Pencil,
  Phone,
  Receipt,
  Tag as TagIcon,
  UserRound,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { compact, img, ratePer1k, rupees, timeAgo, verticalLabel } from '../../lib/format';
import { THEME_OPTIONS, useTheme } from '../../lib/theme';
import { InstagramIcon, YoutubeIcon } from '../../ui/PlatformIcons';
import {
  Button,
  Card,
  Chips,
  EmptyState,
  IconAction,
  IconActions,
  ListGroup,
  ListRow,
  Notice,
  PageHeader,
  Segmented,
  Skeleton,
  Stat,
  StatGrid,
  Status,
} from '../../ui';

const STATUS = {
  pending: { tone: 'warning', label: 'Under review' },
  approved: { tone: 'success', label: 'Verified' },
  info_requested: { tone: 'warning', label: 'Info needed' },
  rejected: { tone: 'danger', label: 'Not approved' },
};

const CAMPAIGN_STATUS = {
  pending: ['warning', 'In review'],
  live: ['live', 'Live'],
  paused: ['warning', 'Paused'],
  ended: ['neutral', 'Ended'],
  completed: ['neutral', 'Ended'],
};

// Campaigns are set up together with our team; this is how a brand asks for one.
const REQUEST_CAMPAIGN = '/#pilot';

export function BrandStatus({ status }) {
  const s = STATUS[status] ?? STATUS.pending;
  return <Status tone={s.tone}>{s.label}</Status>;
}

function useBrandSummary() {
  return useQuery({ queryKey: ['brand-summary'], queryFn: () => api('/brand/summary') });
}

const costPer1k = (spentPaise, views) => (views > 0 ? `₹${((spentPaise / views) * 10).toFixed(0)}` : '—');

function StatusNotice({ brand, hasCampaigns }) {
  switch (brand.approvalStatus) {
    case 'approved':
      return hasCampaigns ? null : (
        <Notice tone="success" title="Your brand is verified" action={<Button size="sm" to={REQUEST_CAMPAIGN}>Request a campaign</Button>}>
          Tell us what to promote. We set up the brief, rate per 1,000 views and budget with you, then creators start posting.
        </Notice>
      );
    case 'info_requested':
      return (
        <Notice tone="warning" title="We need a bit more information" action={<Button to="/onboarding/brand" size="sm" variant="secondary">Update</Button>}>
          {brand.adminNote}
        </Notice>
      );
    case 'rejected':
      return (
        <Notice tone="danger" title="Your brand wasn’t approved" action={<Button to="/onboarding/brand" size="sm" variant="secondary">Update</Button>}>
          {brand.adminNote}
        </Notice>
      );
    default:
      return (
        <Notice tone="warning" title="We’re reviewing your brand">
          This usually takes less than a day. We’ll email you when it’s done.
        </Notice>
      );
  }
}

export function BrandOverview() {
  const { brand, user } = useAuth();
  const summary = useBrandSummary();
  if (!brand) return null;
  const t = summary.data?.totals;
  const campaigns = summary.data?.campaigns ?? [];
  const approved = brand.approvalStatus === 'approved';
  const live = (t?.live ?? 0) > 0 || campaigns.some((c) => c.status === 'ended');
  const steps = [
    { done: true, title: 'Create your account', subtitle: 'Done' },
    { done: approved, title: 'Get your brand verified', subtitle: approved ? 'Done' : 'Usually under a day' },
    { done: campaigns.length > 0, title: 'Set up your first campaign', subtitle: campaigns.length ? 'Done' : 'We agree the brief, rate per 1K views and budget with you' },
    { done: live, title: 'Go live', subtitle: live ? 'Done' : 'Creators start posting clips' },
  ];

  return (
    <>
      <PageHeader eyebrow={brand.company} title={`Hi, ${user?.name?.split(' ')[0] || 'there'}`} actions={<BrandStatus status={brand.approvalStatus} />} />
      <StatusNotice brand={brand} hasCampaigns={campaigns.length > 0} />

      {summary.isPending ? (
        <Skeleton className="mt-5 h-28" />
      ) : (
        <StatGrid className="mt-5">
          <Stat label="Views" value={compact(t?.views ?? 0)} hint="From approved clips" />
          <Stat label="Spend" value={rupees(t?.spentPaise ?? 0)} tone="money" />
          <Stat label="Cost / 1K views" value={costPer1k(t?.spentPaise ?? 0, t?.views ?? 0)} />
          <Stat label="Clips" value={t?.clips ?? 0} hint={t?.clips ? `${t.approvedClips} approved` : undefined} />
        </StatGrid>
      )}

      <IconActions className="mt-6">
        <IconAction icon={Megaphone} label="Campaigns" to="/brand/campaigns" />
        <IconAction icon={Film} label="Clips" to="/brand/clips" />
        <IconAction icon={Building2} label="Account" to="/brand/account" />
        <IconAction icon={CircleHelp} label="Help" to={REQUEST_CAMPAIGN} />
      </IconActions>

      {campaigns.length > 0 && (
        <section className="mt-8">
          <div className="mb-2.5 flex items-center justify-between px-1">
            <h2 className="text-[15px] font-semibold">Your campaigns</h2>
            <Button variant="ghost" size="sm" to="/brand/campaigns">
              See all
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {campaigns.slice(0, 2).map((c) => (
              <BrandCampaignCard key={c.id} c={c} />
            ))}
          </div>
        </section>
      )}

      <ListGroup title="Getting started" className="mt-8">
        {steps.map((s) => (
          <ListRow key={s.title} icon={s.done ? CheckCircle2 : Circle} title={s.title} subtitle={s.subtitle} />
        ))}
      </ListGroup>
    </>
  );
}

function BrandCampaignCard({ c }) {
  const [tone, label] = CAMPAIGN_STATUS[c.status] ?? ['neutral', c.status];
  const usedPct = c.budgetPaise ? Math.min(100, Math.round(((c.spentPaise || 0) / c.budgetPaise) * 100)) : 0;
  return (
    <Card className="overflow-hidden">
      <div className="flex gap-4 p-4">
        {c.coverUrl ? (
          <img src={img(c.coverUrl, 300)} alt="" loading="lazy" className="size-16 shrink-0 rounded-2xl object-cover" />
        ) : (
          <span className="stripes size-16 shrink-0 rounded-2xl" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-2 font-medium leading-snug">{c.title}</p>
            <Status tone={tone} className="shrink-0">
              {label}
            </Status>
          </div>
          <p className="mt-1 text-xs text-muted">
            {ratePer1k(c.ratePer1kPaise)} per 1K views · ends {new Date(c.endsAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </p>
          <div className="mt-3">
            <div className="flex justify-between text-xs">
              <span className="text-muted">Budget used</span>
              <span className="font-mono tabular-nums">
                <span className="text-c-money">{rupees(c.spentPaise)}</span> <span className="text-faint">/ {rupees(c.budgetPaise)}</span>
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-glass-3">
              <div className="h-full rounded-full bg-primary" style={{ width: `${usedPct}%` }} />
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 border-t border-border">
        {[
          ['Views', compact(c.views)],
          ['Clips', c.clips],
          ['Creators', c.creators],
        ].map(([k, v], i) => (
          <div key={k} className={i < 2 ? 'border-r border-border p-3' : 'p-3'}>
            <p className="font-mono text-sm font-medium tabular-nums">{v}</p>
            <p className="label mt-0.5">{k}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function BrandCampaigns() {
  const summary = useBrandSummary();
  const campaigns = summary.data?.campaigns ?? [];
  return (
    <>
      <PageHeader
        eyebrow="Brand"
        title="Campaigns"
        actions={
          <Button size="sm" to={REQUEST_CAMPAIGN}>
            Request a campaign
          </Button>
        }
      />
      {summary.isPending ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <EmptyState icon={Megaphone} title="No campaigns yet" action={<Button to={REQUEST_CAMPAIGN}>Request a campaign</Button>}>
          Tell us what you want to promote. We set up the brief, rate per 1,000 views and budget with you. Once it’s live, results show up here.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {campaigns.map((c) => (
            <BrandCampaignCard key={c.id} c={c} />
          ))}
        </div>
      )}
    </>
  );
}

const CLIP_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'approved', label: 'Approved' },
  { value: 'pending', label: 'In review' },
];

export function BrandClips() {
  const [filter, setFilter] = useState('all');
  const q = useQuery({ queryKey: ['brand-clips'], queryFn: () => api('/brand/clips') });
  const clips = q.data?.clips ?? [];
  const shown = filter === 'all' ? clips : clips.filter((c) => c.status === filter);
  return (
    <>
      <PageHeader eyebrow="Brand" title="Clips" subtitle="Every clip creators posted for your campaigns. Our team reviews each one, and you only pay for views on approved clips." />
      {clips.length > 0 && (
        <div className="mb-4">
          <Chips label="Filter clips" value={filter} onChange={setFilter} options={CLIP_FILTERS} />
        </div>
      )}
      {q.isPending ? (
        <Skeleton className="h-64" />
      ) : clips.length === 0 ? (
        <EmptyState icon={Film} title="No clips yet">
          When creators post clips for your live campaigns, they show up here with their views.
        </EmptyState>
      ) : shown.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">No clips with this status.</p>
      ) : (
        <div className="glass divide-y divide-border overflow-hidden rounded-3xl">
          {shown.map((c) => {
            const Icon = c.platform === 'youtube' ? YoutubeIcon : InstagramIcon;
            return (
              <a key={c.id} href={c.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-glass-2 md:px-4">
                {c.thumbnailUrl ? (
                  <img src={c.thumbnailUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-16 w-12 shrink-0 rounded-xl object-cover" />
                ) : (
                  <span className="stripes grid h-16 w-12 shrink-0 place-items-center rounded-xl">
                    <Icon className="size-4 text-muted" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <Status tone={c.status === 'approved' ? 'success' : 'warning'}>{c.status === 'approved' ? 'Approved' : 'In review'}</Status>
                    {c.creator && <span className="truncate text-xs text-muted">{c.creator}</span>}
                  </span>
                  <span className="mt-1 block truncate text-sm font-medium">{c.title || c.campaign.title}</span>
                  <span className="block truncate text-xs text-faint">
                    {c.campaign.title} · {c.lastCheckedAt ? `views updated ${timeAgo(c.lastCheckedAt)}` : 'views update every few hours'}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-mono text-sm font-medium tabular-nums">{compact(c.views)}</span>
                  <span className="label">views</span>
                </span>
                <ExternalLink className="hidden size-4 shrink-0 text-faint sm:block" aria-hidden />
              </a>
            );
          })}
        </div>
      )}
    </>
  );
}

export function BrandAccount() {
  const { brand, user, signOut } = useAuth();
  const [theme, setTheme] = useTheme();
  if (!brand) return null;

  return (
    <>
      <PageHeader eyebrow="Brand" title="Account" actions={<Button to="/onboarding/brand" variant="secondary" size="sm"><Pencil className="size-3.5" aria-hidden /> Edit</Button>} />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start xl:gap-10">
        <div className="space-y-8">
          <ListGroup title="Company">
            <ListRow icon={Building2} title={brand.company} subtitle={verticalLabel(brand.vertical)} trailing={<BrandStatus status={brand.approvalStatus} />} />
            <ListRow icon={Globe} title="Website" subtitle={brand.website || 'Not added'} />
            <ListRow icon={TagIcon} title="GSTIN" subtitle={brand.gstin || 'Not added'} />
          </ListGroup>

          <ListGroup title="Contact">
            <ListRow icon={UserRound} title={brand.contactName} subtitle="Contact person" />
            <ListRow icon={Mail} title="Email" subtitle={user?.email} />
            <ListRow icon={Phone} title="Phone" subtitle={brand.contactPhone || 'Not added'} />
          </ListGroup>
        </div>

        <div className="space-y-8">
          <ListGroup title="Billing">
            <ListRow icon={CreditCard} title="How you pay" subtitle="We send a GST invoice for each campaign budget before it goes live" />
            <ListRow icon={Receipt} title="Unused budget" subtitle="Returned to you or moved to your next campaign" />
          </ListGroup>

          <ListGroup title="Preferences">
            <div className="flex items-center gap-3.5 px-4 py-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-glass-3">
                <Moon className="size-[18px]" strokeWidth={1.75} aria-hidden />
              </span>
              <span className="flex-1 text-sm font-medium">Theme</span>
              <Segmented label="Theme" value={theme} onChange={setTheme} options={THEME_OPTIONS} />
            </div>
          </ListGroup>

          <ListGroup title="Support">
            <ListRow icon={BadgeCheck} title="Why we verify brands" subtitle="It keeps creators safe and payouts real" />
            <ListRow icon={CircleHelp} title="Talk to us" subtitle="Questions about a campaign or invoice" to={REQUEST_CAMPAIGN} />
            <ListRow icon={LogOut} title="Sign out" tone="danger" onClick={signOut} />
          </ListGroup>
        </div>
      </div>
    </>
  );
}
