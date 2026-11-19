import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Megaphone, Pause, Play, Plus, Square, Trash2, Users } from 'lucide-react';
import { api } from '../../lib/api';
import { VERTICALS, compact, img, rupees, verticalLabel } from '../../lib/format';
import CampaignCard from '../../components/CampaignCard';
import ImageInput, { GalleryInput } from '../../components/ImageInput';
import { InstagramIcon, YoutubeIcon } from '../../ui/PlatformIcons';
import { Button, Card, Chips, EmptyState, Field, Input, Notice, PageHeader, Select, Skeleton, Status, Textarea, cx } from '../../ui';

const STATUS_TONE = { draft: 'neutral', pending: 'warning', live: 'live', paused: 'warning', ended: 'neutral' };
const cap = (s) => s[0].toUpperCase() + s.slice(1);

const DEFAULT_DELIVERABLES = ['Vertical video, 9:16', '15–60 seconds long', 'Your own hook in the first 2 seconds', 'On-screen captions', '#ad in the caption'];
const DEFAULT_RULES = ['Post from your own public account', 'Add your own edit: no plain re-uploads', 'No misleading or out-of-context edits', 'Keep the post up for at least 30 days'];

/* ---------------- List ---------------- */

export function AdminCampaigns() {
  const [status, setStatus] = useState('all');
  const { data, isPending, error } = useQuery({
    queryKey: ['admin', 'campaigns', status],
    queryFn: () => api(`/admin/campaigns${status !== 'all' ? `?status=${status}` : ''}`),
  });
  const counts = data?.counts ?? {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Campaigns"
        subtitle="Create campaigns, take them live, pause or end them."
        actions={
          <Button to="/admin/campaigns/new" arrow>
            <Plus className="size-4" aria-hidden /> New campaign
          </Button>
        }
      />
      <div className="mb-5">
        <Chips
          label="Filter campaigns"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: `All${status === 'all' && data ? ` · ${total}` : ''}` },
            ...['live', 'draft', 'paused', 'ended'].map((s) => ({ value: s, label: cap(s) })),
          ]}
        />
      </div>
      {error && <Notice tone="danger">{error.message}</Notice>}
      {isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : data.campaigns.length === 0 ? (
        <EmptyState icon={Megaphone} title="No campaigns here" action={<Button to="/admin/campaigns/new">Create a campaign</Button>}>
          Create one for a verified brand, save it as a draft, then take it live.
        </EmptyState>
      ) : (
        <div className="glass divide-y divide-border overflow-hidden rounded-3xl">
          {data.campaigns.map((c) => {
            const used = c.budget ? Math.min(100, Math.round((c.spent / c.budget) * 100)) : 0;
            return (
              <Link key={c.id} to={`/admin/campaigns/${c.id}`} className="flex items-center gap-3 p-3 hover:bg-glass-2 md:gap-4 md:p-4">
                {c.coverUrl ? (
                  <img src={img(c.coverUrl, 240)} alt="" className="h-16 w-24 shrink-0 rounded-xl object-cover" />
                ) : (
                  <span className="stripes h-16 w-24 shrink-0 rounded-xl" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium">{c.title}</span>
                    <Status tone={STATUS_TONE[c.status]}>{cap(c.status)}</Status>
                  </span>
                  <span className="mt-0.5 block truncate text-[13px] text-muted">
                    {c.brand?.name} · ₹{c.ratePer1k}/1K · ends {new Date(c.endsAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </span>
                  <span className="mt-1.5 flex items-center gap-3 font-mono text-xs text-muted">
                    <span className="flex-1">
                      <span className="block h-1 overflow-hidden rounded-full bg-glass-3">
                        <span className="block h-full rounded-full bg-text" style={{ width: `${used}%` }} />
                      </span>
                    </span>
                    <span className="shrink-0">
                      {rupees(c.spent * 100)} / {rupees(c.budget * 100)}
                    </span>
                    <span className="hidden shrink-0 items-center gap-1 sm:flex">
                      <Users className="size-3.5" aria-hidden /> {c.creators}
                    </span>
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ---------------- Create / edit ---------------- */

const toInputDate = (d) => {
  const x = new Date(d);
  return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

function blank() {
  return {
    brandId: '',
    title: '',
    brief: '',
    vertical: 'genz',
    type: 'clipping',
    platforms: ['instagram'],
    ratePer1k: '50',
    budget: '25000',
    perClipCap: '5000',
    startsAt: toInputDate(Date.now()),
    endsAt: toInputDate(Date.now() + 14 * 86400000),
    coverUrl: '',
    gallery: [],
    assetsUrl: '',
    deliverables: DEFAULT_DELIVERABLES.join('\n'),
    rules: DEFAULT_RULES.join('\n'),
  };
}

function fromCampaign(c) {
  return {
    brandId: c.brandId,
    title: c.title,
    brief: c.brief,
    vertical: c.vertical,
    type: c.type,
    platforms: c.platforms,
    ratePer1k: String(c.ratePer1k),
    budget: String(c.budget),
    perClipCap: String(c.perClipCap || ''),
    startsAt: toInputDate(c.startsAt),
    endsAt: toInputDate(c.endsAt),
    coverUrl: c.coverUrl || '',
    gallery: c.gallery || [],
    assetsUrl: c.assetsUrl || '',
    deliverables: (c.deliverables || []).join('\n'),
    rules: (c.rules || []).join('\n'),
  };
}

const splitLines = (s) => s.split('\n').map((l) => l.trim()).filter(Boolean);

function toBody(f) {
  // End of the chosen day, local time; start at the beginning of its day.
  const end = new Date(`${f.endsAt}T23:59:00`);
  const start = new Date(`${f.startsAt}T00:00:00`);
  return {
    brandId: f.brandId,
    title: f.title,
    brief: f.brief,
    vertical: f.vertical,
    type: f.type,
    platforms: f.platforms,
    ratePer1k: Number(f.ratePer1k),
    budget: Number(f.budget),
    perClipCap: Number(f.perClipCap || 0),
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    coverUrl: f.coverUrl,
    gallery: f.gallery,
    assetsUrl: f.assetsUrl.trim(),
    deliverables: splitLines(f.deliverables),
    rules: splitLines(f.rules),
  };
}

export function AdminCampaignEditor() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [f, setF] = useState(blank);
  const [addingBrand, setAddingBrand] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e?.target ? e.target.value : e }));

  const brands = useQuery({ queryKey: ['admin', 'brands', 'approved'], queryFn: () => api('/admin/brands?status=approved') });
  const existing = useQuery({ queryKey: ['admin', 'campaign', id], queryFn: () => api(`/admin/campaigns/${id}`), enabled: !isNew });
  useEffect(() => {
    if (existing.data) setF(fromCampaign(existing.data.campaign));
  }, [existing.data]);

  const save = useMutation({
    mutationFn: (status) =>
      isNew
        ? api('/admin/campaigns', { method: 'POST', body: { ...toBody(f), status } })
        : api(`/admin/campaigns/${id}`, { method: 'PUT', body: toBody(f) }),
    onSuccess: ({ campaign }) => {
      qc.invalidateQueries({ queryKey: ['admin'] });
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      if (isNew) navigate(`/admin/campaigns/${campaign.id}`, { replace: true });
      else qc.setQueryData(['admin', 'campaign', id], { campaign });
    },
  });
  const setStatus = useMutation({
    mutationFn: (status) => api(`/admin/campaigns/${id}/status`, { method: 'PATCH', body: { status } }),
    onSuccess: ({ campaign }) => {
      qc.setQueryData(['admin', 'campaign', id], { campaign });
      qc.invalidateQueries({ queryKey: ['admin'] });
      qc.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
  const remove = useMutation({
    mutationFn: () => api(`/admin/campaigns/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin'] });
      navigate('/admin/campaigns', { replace: true });
    },
  });

  const brandList = brands.data?.brands ?? [];
  const brandName = brandList.find((b) => b._id === f.brandId)?.company || 'Brand';
  const views = Number(f.ratePer1k) > 0 ? Math.floor((Number(f.budget) / Number(f.ratePer1k)) * 1000) : 0;
  const preview = useMemo(
    () => ({
      brand: brandName,
      title: f.title || 'Campaign title',
      ratePer1kPaise: Math.round(Number(f.ratePer1k || 0) * 100),
      budgetLeftPct: 100,
      endsAt: `${f.endsAt}T23:59:00`,
      platforms: f.platforms,
      type: f.type,
      vertical: f.vertical,
      coverUrl: f.coverUrl,
    }),
    [brandName, f]
  );

  if (!isNew && existing.isPending) return <Skeleton className="h-96" />;
  if (!isNew && existing.error) return <Notice tone="danger">{existing.error.message}</Notice>;
  const current = existing.data?.campaign;
  const togglePlatform = (p) => setF((x) => ({ ...x, platforms: x.platforms.includes(p) ? x.platforms.filter((y) => y !== p) : [...x.platforms, p] }));
  const err = save.error || setStatus.error || remove.error;

  return (
    <>
      <Link to="/admin/campaigns" className="mb-5 inline-flex items-center gap-2 text-sm text-muted hover:text-text">
        <ArrowLeft className="size-4" aria-hidden /> Campaigns
      </Link>
      <PageHeader
        eyebrow={isNew ? 'New campaign' : `${current.creators} creators joined`}
        title={isNew ? 'Create a campaign' : current.title}
        actions={!isNew && <Status tone={STATUS_TONE[current.status]}>{cap(current.status)}</Status>}
      />

      {!isNew && (
        <Card className="mb-6 flex flex-wrap items-center gap-2 p-3">
          {['draft', 'paused'].includes(current.status) && (
            <Button size="sm" loading={setStatus.isPending && setStatus.variables === 'live'} onClick={() => setStatus.mutate('live')}>
              <Play className="size-3.5" aria-hidden /> Go live
            </Button>
          )}
          {current.status === 'live' && (
            <Button size="sm" variant="secondary" loading={setStatus.isPending && setStatus.variables === 'paused'} onClick={() => setStatus.mutate('paused')}>
              <Pause className="size-3.5" aria-hidden /> Pause
            </Button>
          )}
          {['live', 'paused', 'draft'].includes(current.status) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => window.confirm('End this campaign? Creators can no longer join, and it can’t be restarted.') && setStatus.mutate('ended')}
            >
              <Square className="size-3.5" aria-hidden /> End
            </Button>
          )}
          {current.status === 'draft' && (
            <Button size="sm" variant="ghost" className="ml-auto text-danger" onClick={() => window.confirm('Delete this draft?') && remove.mutate()}>
              <Trash2 className="size-3.5" aria-hidden /> Delete
            </Button>
          )}
          {current.status === 'live' && (
            <Link to={`/campaigns/${current.id}`} className="ml-auto text-sm text-muted underline underline-offset-4 hover:text-text">
              View public page
            </Link>
          )}
          {!current.brandApproved && <p className="w-full text-[13px] text-warning">This brand isn’t verified yet. Approve it in Brands before going live.</p>}
        </Card>
      )}

      {err && <Notice tone="danger" className="mb-5">{err.message}</Notice>}
      {save.isSuccess && !isNew && <Notice tone="success" title="Saved" className="mb-5" />}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate('draft');
          }}
        >
          <Section title="Brand">
            {addingBrand ? (
              <AddBrandForm
                onDone={(brand) => {
                  setAddingBrand(false);
                  if (brand) {
                    qc.invalidateQueries({ queryKey: ['admin', 'brands'] });
                    setF((x) => ({ ...x, brandId: brand._id }));
                  }
                }}
              />
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <Field label="Verified brand" className="flex-1">
                  {(p) => (
                    <Select {...p} required value={f.brandId} onChange={set('brandId')}>
                      <option value="" disabled>
                        {brands.isPending ? 'Loading…' : 'Choose a brand'}
                      </option>
                      {brandList.map((b) => (
                        <option key={b._id} value={b._id}>
                          {b.company} · {verticalLabel(b.vertical)}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Button type="button" variant="secondary" onClick={() => setAddingBrand(true)}>
                  <Plus className="size-4" aria-hidden /> Add brand
                </Button>
              </div>
            )}
          </Section>

          <Section title="Basics">
            <Field label="Title" hint="Short and specific, e.g. “New masala flavour launch”">
              {(p) => <Input {...p} required maxLength={100} value={f.title} onChange={set('title')} />}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Type">
                {(p) => (
                  <Select {...p} value={f.type} onChange={set('type')}>
                    <option value="clipping">Clipping (brand footage)</option>
                    <option value="ugc">UGC (face to camera)</option>
                  </Select>
                )}
              </Field>
              <Field label="Category">
                {(p) => (
                  <Select {...p} value={f.vertical} onChange={set('vertical')}>
                    {VERTICALS.map((v) => (
                      <option key={v.value} value={v.value}>
                        {v.label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
            <fieldset>
              <legend className="mb-2 px-1 text-[13px] font-medium text-muted">Platforms</legend>
              <div className="flex gap-2">
                {[
                  ['instagram', 'Instagram Reels', InstagramIcon],
                  ['youtube', 'YouTube Shorts', YoutubeIcon],
                ].map(([p, label, Icon]) => {
                  const on = f.platforms.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      aria-pressed={on}
                      onClick={() => togglePlatform(p)}
                      className={cx('flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl text-sm font-medium transition-colors', on ? 'bg-primary text-primary-fg' : 'glass text-muted')}
                    >
                      <Icon className="size-4" /> {label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <Field label="Brief" hint="What creators should make, the vibe, timestamps to use.">
              {(p) => <Textarea {...p} required minLength={10} rows={4} value={f.brief} onChange={set('brief')} />}
            </Field>
          </Section>

          <Section title="Money">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Rate per 1K views (₹)">
                {(p) => <Input {...p} type="number" inputMode="decimal" min={1} step="0.5" required value={f.ratePer1k} onChange={set('ratePer1k')} />}
              </Field>
              <Field label="Total budget (₹)">
                {(p) => <Input {...p} type="number" inputMode="numeric" min={1000} step={500} required value={f.budget} onChange={set('budget')} />}
              </Field>
              <Field label="Max per clip (₹)" optional>
                {(p) => <Input {...p} type="number" inputMode="numeric" min={0} step={100} value={f.perClipCap} onChange={set('perClipCap')} />}
              </Field>
            </div>
            <p className="rounded-2xl bg-glass-2 px-4 py-3 text-sm shadow-[inset_0_1px_0_var(--glass-hi)]">
              This budget buys about <span className="font-mono font-medium">{compact(views)}</span> views
              {Number(f.perClipCap) > 0 && Number(f.ratePer1k) > 0 && (
                <span className="text-muted"> · one clip earns at most {compact(Math.floor((Number(f.perClipCap) / Number(f.ratePer1k)) * 1000))} views’ worth</span>
              )}
            </p>
          </Section>

          <Section title="Dates">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Starts">{(p) => <Input {...p} type="date" required value={f.startsAt} onChange={set('startsAt')} />}</Field>
              <Field label="Ends">{(p) => <Input {...p} type="date" required min={toInputDate(Date.now())} value={f.endsAt} onChange={set('endsAt')} />}</Field>
            </div>
          </Section>

          <Section title="Images">
            <div>
              <p className="mb-2 px-1 text-[13px] font-medium text-muted">Cover</p>
              <ImageInput label="Cover" value={f.coverUrl} onChange={set('coverUrl')} />
            </div>
            <div>
              <p className="mb-2 px-1 text-[13px] font-medium text-muted">Inspiration (up to 6)</p>
              <GalleryInput value={f.gallery} onChange={set('gallery')} />
            </div>
          </Section>

          <Section title="For creators">
            <Field label="What to post" hint="One per line.">
              {(p) => <Textarea {...p} rows={5} value={f.deliverables} onChange={set('deliverables')} />}
            </Field>
            <Field label="Rules" hint="One per line.">
              {(p) => <Textarea {...p} rows={4} value={f.rules} onChange={set('rules')} />}
            </Field>
            <Field label="Footage link" optional hint="Google Drive or Dropbox folder. Shown only to creators who join.">
              {(p) => <Input {...p} type="url" inputMode="url" placeholder="https://drive.google.com/…" value={f.assetsUrl} onChange={set('assetsUrl')} />}
            </Field>
          </Section>

          <div className="glass-solid sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-10 bg-bg/95 flex flex-col gap-2 rounded-3xl p-2 sm:flex-row md:bottom-4">
            <Button type="submit" variant={isNew ? 'secondary' : 'primary'} block loading={save.isPending && save.variables === 'draft'}>
              {isNew ? 'Save as draft' : 'Save changes'}
            </Button>
            {isNew && (
              <Button
                type="button"
                block
                arrow
                loading={save.isPending && save.variables === 'live'}
                onClick={(e) => {
                  const form = e.currentTarget.closest('form');
                  if (form.reportValidity()) save.mutate('live');
                }}
              >
                Save and go live
              </Button>
            )}
          </div>
        </form>

        <aside className="lg:sticky lg:top-10">
          <p className="mb-2.5 px-1 text-[15px] font-semibold">Preview</p>
          <CampaignCard campaign={preview} />
          <p className="mt-2 px-1 text-xs text-faint">How creators see it in the feed.</p>
        </aside>
      </div>
    </>
  );
}

function Section({ title, children }) {
  return (
    <section>
      <h2 className="mb-2.5 px-1 text-[15px] font-semibold">{title}</h2>
      <Card className="space-y-4 p-4 md:p-5">{children}</Card>
    </section>
  );
}

function AddBrandForm({ onDone }) {
  const [b, setB] = useState({ company: '', contactName: '', email: '', vertical: 'genz', website: '' });
  const set = (k) => (e) => setB((x) => ({ ...x, [k]: e.target.value }));
  const create = useMutation({ mutationFn: () => api('/admin/brands', { method: 'POST', body: b }), onSuccess: ({ brand }) => onDone(brand) });
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Creates a verified brand. If this person signs in with Google using the same email, they’ll see it.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company">{(p) => <Input {...p} value={b.company} onChange={set('company')} />}</Field>
        <Field label="Contact name">{(p) => <Input {...p} value={b.contactName} onChange={set('contactName')} />}</Field>
        <Field label="Contact email">{(p) => <Input {...p} type="email" value={b.email} onChange={set('email')} />}</Field>
        <Field label="Category">
          {(p) => (
            <Select {...p} value={b.vertical} onChange={set('vertical')}>
              {VERTICALS.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      {create.error && <Notice tone="danger">{create.error.message}</Notice>}
      <div className="flex gap-2">
        <Button type="button" loading={create.isPending} onClick={() => create.mutate()}>
          Add brand
        </Button>
        <Button type="button" variant="ghost" onClick={() => onDone(null)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
