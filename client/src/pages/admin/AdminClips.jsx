import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ClipboardCheck, ExternalLink, IndianRupee, RefreshCw, ShieldAlert, X } from 'lucide-react';
import { api } from '../../lib/api';
import { compact, rupees, timeAgo } from '../../lib/format';
import { InstagramIcon, YoutubeIcon } from '../../ui/PlatformIcons';
import { Button, Card, Chips, EmptyState, Input, Notice, PageHeader, Skeleton, Status, Textarea } from '../../ui';

const SUB_TONE = { pending: 'warning', approved: 'success', rejected: 'danger', removed: 'neutral' };
const cap = (s) => s[0].toUpperCase() + s.slice(1);

/* ---------------- Clip review ---------------- */

export function AdminClips() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('pending');
  const { data, isPending, error } = useQuery({ queryKey: ['admin', 'submissions', status], queryFn: () => api(`/admin/submissions?status=${status}`) });
  const sync = useMutation({
    mutationFn: () => api('/admin/submissions/sync', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }),
  });
  const counts = data?.counts ?? {};

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Clips"
        subtitle="Approve clips that follow the brief. Only approved clips earn."
        actions={
          <Button variant="secondary" size="sm" loading={sync.isPending} onClick={() => sync.mutate()}>
            {!sync.isPending && <RefreshCw className="size-3.5" aria-hidden />} Check views now
          </Button>
        }
      />
      {sync.data && (
        <Notice tone="success" className="mb-4" title={`Checked ${sync.data.checked} clips`}>
          Credited {rupees(sync.data.credited)}
          {sync.data.flagged ? ` · ${sync.data.flagged} flagged` : ''}
          {sync.data.errors ? ` · ${sync.data.errors} couldn’t be read` : ''}. This also runs automatically every 6 hours.
        </Notice>
      )}
      <div className="mb-5">
        <Chips
          label="Filter clips"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'pending', label: `To review${counts.pending ? ` · ${counts.pending}` : ''}` },
            { value: 'flagged', label: `Flagged${counts.flagged ? ` · ${counts.flagged}` : ''}` },
            { value: 'approved', label: 'Approved' },
            { value: 'rejected', label: 'Rejected' },
          ]}
        />
      </div>
      {error && <Notice tone="danger">{error.message}</Notice>}
      {isPending ? (
        <Skeleton className="h-40" />
      ) : data.submissions.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title={status === 'pending' ? 'All caught up' : 'Nothing here'}>
          {status === 'pending' ? 'New clips from creators will appear here.' : 'Try another filter.'}
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {data.submissions.map((s) => (
            <ClipReviewCard key={s.id} s={s} />
          ))}
        </div>
      )}
    </>
  );
}

function ClipReviewCard({ s }) {
  const qc = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const act = useMutation({
    mutationFn: (action) => api(`/admin/submissions/${s.id}`, { method: 'PATCH', body: { action, note } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }),
  });
  const Icon = s.platform === 'youtube' ? YoutubeIcon : InstagramIcon;
  const eng = s.views ? (((s.likes || 0) + (s.comments || 0)) / s.views) * 100 : null;

  return (
    <Card className="p-4">
      <div className="flex gap-3">
        <a href={s.url} target="_blank" rel="noreferrer" className="relative shrink-0">
          {s.thumbnailUrl ? (
            <img src={s.thumbnailUrl} alt="" referrerPolicy="no-referrer" className="h-28 w-20 rounded-xl object-cover" />
          ) : (
            <span className="stripes block h-28 w-20 rounded-xl" />
          )}
          <span className="glass-solid absolute bottom-1.5 right-1.5 grid size-7 place-items-center rounded-full">
            <Icon className="size-3.5" />
          </span>
        </a>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Status tone={SUB_TONE[s.status]}>{cap(s.status)}</Status>
            {s.flagged && (
              <span className="inline-flex items-center gap-1 text-xs text-warning">
                <ShieldAlert className="size-3.5" aria-hidden /> Flagged
              </span>
            )}
          </div>
          <p className="mt-1 truncate text-sm font-medium">{s.campaign?.title}</p>
          <p className="truncate text-[13px] text-muted">
            {s.creator?.name} · {s.creator?.email}
          </p>
          <p className="mt-1.5 font-mono text-xs text-muted tabular-nums">
            <span className="text-text">{compact(s.views)}</span> views · {s.likes != null ? compact(s.likes) : '—'} likes · {s.comments != null ? compact(s.comments) : '—'} comments
            {eng != null && ` · ${eng.toFixed(1)}% eng.`}
          </p>
          <p className="mt-0.5 font-mono text-xs text-muted">
            Earned <span className="text-text">{rupees(s.earnedPaise)}</span> · submitted {timeAgo(s.createdAt)}
          </p>
          {s.flagReason && <p className="mt-1 text-xs text-warning">{s.flagReason}</p>}
          {s.checkError && <p className="mt-1 text-xs text-danger">{s.checkError}</p>}
          <a href={s.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-muted underline underline-offset-4 hover:text-text">
            Watch post <ExternalLink className="size-3" aria-hidden />
          </a>
        </div>
      </div>

      {rejecting ? (
        <form
          className="mt-4 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            act.mutate('reject');
          }}
        >
          <Textarea autoFocus required rows={2} placeholder="Why? The creator will see this, e.g. “Plain re-upload, no edit”" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Reason" />
          <div className="flex gap-2">
            <Button type="submit" variant="danger" size="sm" loading={act.isPending}>
              Reject clip
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setRejecting(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {s.status !== 'approved' && s.status !== 'rejected' && (
            <Button size="sm" loading={act.isPending && act.variables === 'approve'} onClick={() => act.mutate('approve')}>
              <Check className="size-3.5" aria-hidden /> Approve
            </Button>
          )}
          {s.flagged && (
            <Button size="sm" variant="secondary" loading={act.isPending && act.variables === 'clear_flag'} onClick={() => act.mutate('clear_flag')}>
              Views look real
            </Button>
          )}
          {s.status !== 'rejected' && (
            <Button size="sm" variant="outlineDanger" onClick={() => setRejecting(true)}>
              <X className="size-3.5" aria-hidden /> Reject
            </Button>
          )}
        </div>
      )}
      {act.error && <Notice tone="danger" className="mt-3">{act.error.message}</Notice>}
    </Card>
  );
}

/* ---------------- Payouts ---------------- */

export function AdminPayouts() {
  const [status, setStatus] = useState('requested');
  const { data, isPending, error } = useQuery({ queryKey: ['admin', 'withdrawals', status], queryFn: () => api(`/admin/withdrawals?status=${status}`) });

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Payouts"
        subtitle="Send the amount by UPI from your bank app, then record the transaction reference (UTR)."
      />
      {data?.requestedTotalPaise > 0 && (
        <Card className="mb-5 p-5">
          <p className="text-[13px] text-muted">Waiting to be paid</p>
          <p className="mt-1 font-mono text-3xl font-medium tabular-nums">{rupees(data.requestedTotalPaise)}</p>
        </Card>
      )}
      <div className="mb-5">
        <Chips
          label="Filter payouts"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'requested', label: 'To pay' },
            { value: 'paid', label: 'Paid' },
            { value: 'rejected', label: 'Rejected' },
          ]}
        />
      </div>
      {error && <Notice tone="danger">{error.message}</Notice>}
      {isPending ? (
        <Skeleton className="h-32" />
      ) : data.withdrawals.length === 0 ? (
        <EmptyState icon={IndianRupee} title={status === 'requested' ? 'Nothing to pay' : 'Nothing here'}>
          Creators’ withdrawal requests show up here.
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {data.withdrawals.map((w) => (
            <PayoutCard key={w.id} w={w} />
          ))}
        </div>
      )}
    </>
  );
}

function PayoutCard({ w }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState(null);
  const [value, setValue] = useState('');
  const act = useMutation({
    mutationFn: () => api(`/admin/withdrawals/${w.id}`, { method: 'PATCH', body: mode === 'paid' ? { action: 'paid', reference: value } : { action: 'reject', note: value } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }),
  });
  const [copied, setCopied] = useState(false);

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-2xl font-medium tabular-nums">{rupees(w.amountPaise)}</p>
          <p className="mt-0.5 truncate text-[13px] text-muted">
            {w.creator?.name} · {w.creator?.email} · {timeAgo(w.createdAt)}
          </p>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(w.upiId).then(() => setCopied(true))}
            className="mt-2 inline-flex items-center gap-2 rounded-full bg-glass-2 px-3 py-1 font-mono text-sm hover:bg-glass-3"
            title="Copy UPI ID"
          >
            {w.upiId} <span className="font-sans text-xs text-muted">{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
        <Status tone={w.status === 'paid' ? 'success' : w.status === 'rejected' ? 'danger' : 'warning'}>{cap(w.status)}</Status>
      </div>
      {w.reference && <p className="mt-2 font-mono text-xs text-muted">UTR {w.reference}</p>}
      {w.note && <p className="mt-2 text-xs text-danger">{w.note}</p>}

      {w.status === 'requested' &&
        (mode ? (
          <form
            className="mt-4 flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              act.mutate();
            }}
          >
            <Input autoFocus required placeholder={mode === 'paid' ? 'UPI transaction reference (UTR)' : 'Reason (the creator will see this)'} value={value} onChange={(e) => setValue(e.target.value)} aria-label={mode === 'paid' ? 'UTR' : 'Reason'} className="h-10 text-sm" />
            <div className="flex gap-2">
              <Button type="submit" size="sm" variant={mode === 'paid' ? 'primary' : 'danger'} loading={act.isPending}>
                {mode === 'paid' ? 'Mark paid' : 'Reject'}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setMode(null)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="mt-4 flex gap-2">
            <Button size="sm" onClick={() => setMode('paid')}>
              <Check className="size-3.5" aria-hidden /> I’ve paid this
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMode('reject')}>
              Reject
            </Button>
          </div>
        ))}
      {act.error && <Notice tone="danger" className="mt-3">{act.error.message}</Notice>}
    </Card>
  );
}
