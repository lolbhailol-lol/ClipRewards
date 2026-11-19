import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, ExternalLink, Link2, ShieldAlert } from 'lucide-react';
import { api } from '../lib/api';
import { compact, rupees, timeAgo } from '../lib/format';
import { InstagramIcon, YoutubeIcon } from '../ui/PlatformIcons';
import { Button, Card, Field, Input, Notice, Status } from '../ui';

const STATUS = {
  pending: ['warning', 'In review'],
  approved: ['success', 'Approved'],
  rejected: ['danger', 'Rejected'],
  removed: ['neutral', 'Removed'],
};

export function useMySubmissions(campaignId) {
  return useQuery({
    queryKey: ['submissions', campaignId ?? 'all'],
    queryFn: () => api(`/submissions/mine${campaignId ? `?campaignId=${campaignId}` : ''}`),
  });
}

export function useWallet() {
  return useQuery({ queryKey: ['wallet'], queryFn: () => api('/submissions/wallet') });
}

/** Paste a Reel/Short link to submit it to a campaign. */
export function SubmitClip({ campaignId, platforms = [] }) {
  const qc = useQueryClient();
  const [url, setUrl] = useState('');
  const submit = useMutation({
    mutationFn: () => api('/submissions', { method: 'POST', body: { campaignId, url } }),
    onSuccess: () => {
      setUrl('');
      qc.invalidateQueries({ queryKey: ['submissions'] });
      qc.invalidateQueries({ queryKey: ['campaign', campaignId] });
      qc.invalidateQueries({ queryKey: ['my-campaigns'] });
    },
  });
  const accepts = platforms.map((p) => (p === 'instagram' ? 'Instagram Reel' : 'YouTube Short')).join(' or ');

  return (
    <Card className="p-4 md:p-5">
      <p className="font-medium">Submit your clip</p>
      <p className="mt-1 text-sm text-muted">Posted your {accepts || 'clip'}? Paste the link. We check it’s on your connected account and start tracking views.</p>
      <form
        className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          submit.mutate();
        }}
      >
        <Field label="Post link" className="flex-1">
          {(p) => (
            <div className="relative">
              <Link2 className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
              <Input {...p} type="url" inputMode="url" required className="pl-10" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
            </div>
          )}
        </Field>
        <Button type="submit" loading={submit.isPending}>
          Submit
        </Button>
      </form>
      {submit.error && <Notice tone="danger" className="mt-3">{submit.error.message}</Notice>}
      {submit.isSuccess && (
        <Notice tone="success" className="mt-3" title="Clip submitted">
          We’ll review it soon. Views are tracked automatically every few hours.
        </Notice>
      )}
    </Card>
  );
}

/** One submitted clip with its status, views and earnings. */
export function ClipRow({ s, showCampaign }) {
  const [tone, label] = STATUS[s.status] ?? STATUS.pending;
  const Icon = s.platform === 'youtube' ? YoutubeIcon : InstagramIcon;
  return (
    <div className="flex items-center gap-3 px-3 py-3 md:px-4">
      {s.thumbnailUrl ? (
        <img src={s.thumbnailUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-16 w-12 shrink-0 rounded-xl object-cover" />
      ) : (
        <span className="stripes grid h-16 w-12 shrink-0 place-items-center rounded-xl">
          <Icon className="size-4 text-muted" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Status tone={tone}>{label}</Status>
          {s.flagged && (
            <span className="inline-flex items-center gap-1 text-xs text-warning">
              <ShieldAlert className="size-3.5" aria-hidden /> Under check
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-sm font-medium">{showCampaign ? s.campaign?.title : s.title || 'Your clip'}</p>
        <p className="mt-0.5 font-mono text-xs text-muted tabular-nums">
          <span className="text-text">{compact(s.views)}</span> views · <span className="text-c-money">{rupees(s.earnedPaise)}</span> earned
          {s.lastCheckedAt && <span className="text-faint"> · {timeAgo(s.lastCheckedAt)}</span>}
        </p>
        {s.status === 'rejected' && s.reviewNote && <p className="mt-0.5 text-xs text-danger">{s.reviewNote}</p>}
        {checkProblem(s) && <p className="mt-0.5 text-xs text-warning">{checkProblem(s)}</p>}
      </div>
      <a href={s.url} target="_blank" rel="noreferrer" aria-label="Open post" className="grid size-9 shrink-0 place-items-center rounded-full text-faint hover:bg-glass-2 hover:text-text">
        <ExternalLink className="size-4" />
      </a>
    </div>
  );
}

export function ClipList({ submissions, showCampaign, empty }) {
  if (!submissions?.length) return empty ?? null;
  return (
    <div className="glass divide-y divide-border overflow-hidden rounded-3xl">
      {submissions.map((s) => (
        <ClipRow key={s.id} s={s} showCampaign={showCampaign} />
      ))}
    </div>
  );
}

export function HoldNote() {
  return (
    <p className="flex items-center gap-1.5 px-1 text-xs text-faint">
      <Clock className="size-3.5" aria-hidden /> New earnings are held for 7 days while views are checked.
    </p>
  );
}

/** Plain-language reason we couldn't read a clip's views (shown to the creator who can fix it). */
export function checkProblem(s) {
  if (!s?.checkError || s.status === 'rejected' || s.status === 'removed') return '';
  if (/no longer public/i.test(s.checkError)) return 'We can’t see this video any more. Make sure it’s still posted and public, or views stop counting.';
  if (/connection expired/i.test(s.checkError)) return 'Your Instagram connection expired. Reconnect it in Profile so views keep counting.';
  return 'We couldn’t read this post’s views on the last check. We’ll try again automatically.';
}
