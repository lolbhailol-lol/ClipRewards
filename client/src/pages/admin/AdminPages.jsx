import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Check, Inbox, IndianRupee, LogOut, Megaphone, Moon } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { timeAgo, verticalLabel } from '../../lib/format';
import { THEME_OPTIONS, useTheme } from '../../lib/theme';
import {
  Button,
  Card,
  Chips,
  EmptyState,
  ListGroup,
  ListRow,
  Notice,
  PageHeader,
  Segmented,
  Select,
  Skeleton,
  Stat,
  StatGrid,
  Status,
  Textarea,
} from '../../ui';
import { BrandStatus } from '../brand/BrandPages';

export function AdminOverview() {
  const { signOut } = useAuth();
  const [theme, setTheme] = useTheme();
  const { data, isPending } = useQuery({ queryKey: ['admin', 'stats'], queryFn: () => api('/admin/stats') });

  return (
    <>
      <PageHeader eyebrow="Admin" title="Overview" subtitle="What needs your attention today." />
      {isPending ? (
        <Skeleton className="h-28" />
      ) : (
        <StatGrid>
          <Stat label="Live" value={data.liveCampaigns ?? 0} hint="Campaigns" />
          <Stat label="To review" value={data.pendingBrands} hint="Brands" />
          <Stat label="New leads" value={data.newLeads} hint="Demo requests" />
          <Stat label="Creators" value={data.creators} hint="Onboarded" />
        </StatGrid>
      )}

      <ListGroup title="Shortcuts" className="mt-8">
        <ListRow icon={Megaphone} title="Campaigns" subtitle="Create, launch, pause or end campaigns" to="/admin/campaigns" />
        <ListRow icon={Check} title="Clips to review" subtitle="Approve clips so they start earning" to="/admin/clips" />
        <ListRow icon={IndianRupee} title="Payouts" subtitle="Pay creators’ withdrawal requests" to="/admin/payouts" />
        <ListRow icon={Building2} title="Review brands" subtitle="Approve new brands before their campaigns go live" to="/admin/brands" />
        <ListRow icon={Inbox} title="Demo requests" subtitle="Brands who asked for a pilot from the website" to="/admin/leads" />
      </ListGroup>

      <ListGroup title="Preferences" className="mt-8">
        <div className="flex items-center gap-3.5 px-4 py-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-glass-3">
            <Moon className="size-[18px]" strokeWidth={1.75} aria-hidden />
          </span>
          <span className="flex-1 text-sm font-medium">Theme</span>
          <Segmented label="Theme" value={theme} onChange={setTheme} options={THEME_OPTIONS} />
        </div>
        <ListRow icon={LogOut} title="Sign out" tone="danger" onClick={signOut} />
      </ListGroup>
    </>
  );
}

const BRAND_TABS = [
  { value: 'pending', label: 'To review' },
  { value: 'info_requested', label: 'Info needed' },
  { value: 'approved', label: 'Verified' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
];

export function AdminBrands() {
  const [status, setStatus] = useState('pending');
  const { data, isPending, error } = useQuery({
    queryKey: ['admin', 'brands', status],
    queryFn: () => api(`/admin/brands${status !== 'all' ? `?status=${status}` : ''}`),
  });

  return (
    <>
      <PageHeader eyebrow="Admin" title="Brands" subtitle="Check each brand is real before its campaigns can go live." />
      <div className="mb-5">
        <Chips label="Filter brands" options={BRAND_TABS} value={status} onChange={setStatus} />
      </div>
      {error && <Notice tone="danger">{error.message}</Notice>}
      {isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : data.brands.length === 0 ? (
        <EmptyState icon={Building2} title={status === 'pending' ? 'All caught up' : 'Nothing here'}>
          {status === 'pending' ? 'New brand sign-ups will appear here for review.' : 'Try another filter.'}
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {data.brands.map((b) => (
            <BrandReviewCard key={b._id} brand={b} />
          ))}
        </div>
      )}
    </>
  );
}

function BrandReviewCard({ brand }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState(null); // 'reject' | 'request_info'
  const [note, setNote] = useState('');

  const act = useMutation({
    mutationFn: (action) => api(`/admin/brands/${brand._id}`, { method: 'PATCH', body: { action, note } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }),
  });

  const website = brand.website && (brand.website.startsWith('http') ? brand.website : `https://${brand.website.replace(/^@/, 'instagram.com/')}`);
  const email = brand.ownerId?.email;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 p-4 md:p-5">
        <div className="min-w-0">
          <p className="truncate text-[17px] font-semibold">{brand.company}</p>
          <p className="mt-0.5 text-[13px] text-muted">
            {verticalLabel(brand.vertical)} · joined {timeAgo(brand.createdAt)}
          </p>
        </div>
        <BrandStatus status={brand.approvalStatus} />
      </div>

      <dl className="grid grid-cols-2 border-y border-border lg:grid-cols-4">
        <Item label="Contact" value={brand.contactName} />
        <Item label="Email" value={email} href={email && `mailto:${email}`} />
        <Item label="Phone" value={brand.contactPhone} href={brand.contactPhone && `tel:${brand.contactPhone.replace(/\s/g, '')}`} />
        <Item label="Website" value={brand.website} href={website} external />
        <Item label="GSTIN" value={brand.gstin} mono />
      </dl>

      <div className="p-4 md:p-5">
        {brand.adminNote && brand.approvalStatus !== 'pending' && !mode && (
          <p className="mb-4 text-sm text-muted">
            <span className="font-medium text-text">Note sent: </span>
            {brand.adminNote}
          </p>
        )}

        {mode ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              act.mutate(mode);
            }}
          >
            <label className="block text-sm font-medium" htmlFor={`note-${brand._id}`}>
              {mode === 'reject' ? 'Why are you rejecting? The brand will see this.' : 'What should the brand add or fix?'}
            </label>
            <Textarea
              id={`note-${brand._id}`}
              autoFocus
              required
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={mode === 'reject' ? 'We couldn’t verify this business.' : 'Please add your website and GSTIN.'}
            />
            {act.error && <Notice tone="danger">{act.error.message}</Notice>}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="ghost" onClick={() => setMode(null)}>
                Cancel
              </Button>
              <Button type="submit" variant={mode === 'reject' ? 'danger' : 'primary'} loading={act.isPending}>
                {mode === 'reject' ? 'Reject brand' : 'Send request'}
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row">
            {brand.approvalStatus !== 'approved' && (
              <Button loading={act.isPending} onClick={() => act.mutate('approve')}>
                <Check className="size-4" aria-hidden /> Approve
              </Button>
            )}
            {brand.approvalStatus !== 'info_requested' && (
              <Button variant="secondary" onClick={() => setMode('request_info')}>
                Ask for info
              </Button>
            )}
            {brand.approvalStatus !== 'rejected' && (
              <Button variant="outlineDanger" onClick={() => setMode('reject')}>
                Reject
              </Button>
            )}
            {act.error && <Notice tone="danger" className="w-full">{act.error.message}</Notice>}
          </div>
        )}
      </div>
    </Card>
  );
}

function Item({ label, value, href, external, mono }) {
  return (
    <div className="min-w-0 px-4 py-3 md:px-5">
      <dt className="label">{label}</dt>
      <dd className={`mt-1 truncate text-sm ${mono ? 'font-mono' : ''}`}>
        {value ? (
          href ? (
            <a href={href} className="underline decoration-border-strong underline-offset-4 hover:decoration-text" {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>
              {value}
            </a>
          ) : (
            value
          )
        ) : (
          <span className="text-faint">—</span>
        )}
      </dd>
    </div>
  );
}

const LEAD_TONE = { new: 'live', contacted: 'warning', converted: 'success', closed: 'neutral' };
const cap = (s) => s[0].toUpperCase() + s.slice(1);

export function AdminLeads() {
  const qc = useQueryClient();
  const { data, isPending, error } = useQuery({ queryKey: ['admin', 'leads'], queryFn: () => api('/admin/leads') });
  const update = useMutation({
    mutationFn: ({ id, status }) => api(`/admin/leads/${id}`, { method: 'PATCH', body: { status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }),
  });

  return (
    <>
      <PageHeader eyebrow="Admin" title="Leads" subtitle="Brands who asked for a pilot from the website." />
      {error && <Notice tone="danger">{error.message}</Notice>}
      {isPending ? (
        <Skeleton className="h-40" />
      ) : data.leads.length === 0 ? (
        <EmptyState icon={Inbox} title="No requests yet">
          Requests from the “Request a pilot” form on the homepage show up here.
        </EmptyState>
      ) : (
        <Card className="divide-y divide-border">
          {data.leads.map((l) => (
            <div key={l._id} className="p-4 md:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{l.company}</p>
                  <p className="mt-0.5 text-[13px] text-muted">
                    {l.name} · {verticalLabel(l.vertical)} · {timeAgo(l.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Status tone={LEAD_TONE[l.status]} className="hidden sm:inline-flex">{cap(l.status)}</Status>
                  <label className="sr-only" htmlFor={`lead-${l._id}`}>Status</label>
                  <Select id={`lead-${l._id}`} className="h-9 w-32 text-sm" value={l.status} onChange={(e) => update.mutate({ id: l._id, status: e.target.value })}>
                    {['new', 'contacted', 'converted', 'closed'].map((s) => (
                      <option key={s} value={s}>{cap(s)}</option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[13px]">
                <a href={`mailto:${l.email}`} className="underline decoration-border-strong underline-offset-4 hover:decoration-text">{l.email}</a>
                {l.phone && <a href={`tel:${l.phone.replace(/\s/g, '')}`} className="underline decoration-border-strong underline-offset-4 hover:decoration-text">{l.phone}</a>}
                <span className="text-muted">Budget: {l.budget || '—'}</span>
              </div>
              {l.message && <p className="mt-3 border-l-2 border-border-strong pl-3 text-sm text-muted">{l.message}</p>}
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
