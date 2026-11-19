import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  Check,
  Download,
  IndianRupee,
  Link2,
  Lock,
  Share2,
  ShieldCheck,
  Upload,
  Users,
  Video,
} from 'lucide-react';
import { api } from '../lib/api';
import { rememberNext, useAuth } from '../lib/auth';
import { startInstagramConnect } from '../lib/social';
import { daysLeft, img, ratePer1k, rupees, verticalLabel } from '../lib/format';
import { PLATFORM_ICON } from '../components/CampaignCard';
import { Button, Card, ListGroup, ListRow, Notice, Spinner, Status, Tag } from '../ui';
import { ClipList, HoldNote, SubmitClip, useMySubmissions } from '../components/Clips';

/** Submit box + this creator's clips for the campaign. */
function CreatorClips({ campaign }) {
  const mine = useMySubmissions(campaign.id);
  const subs = mine.data?.submissions ?? [];
  return (
    <div className="mt-6 space-y-3">
      <SubmitClip campaignId={campaign.id} platforms={campaign.platforms} />
      {subs.length > 0 && (
        <section className="pt-3">
          <h2 className="mb-2.5 px-1 text-[15px] font-semibold">Your clips for this campaign</h2>
          <ClipList submissions={subs} />
          <div className="mt-2">
            <HoldNote />
          </div>
        </section>
      )}
    </div>
  );
}

const PLATFORM_NAME = { instagram: 'Instagram Reels', youtube: 'YouTube Shorts' };

const STEPS = [
  ['Participate', 'Join the campaign to unlock the footage.'],
  ['Download & edit', 'Make your own edit: hook, captions, your style.'],
  ['Post', 'Publish it publicly on your own account with #ad.'],
  ['Submit the link', 'Paste your post link so views start counting.'],
  ['Get paid', 'After approval and a 7-day view check, withdraw to UPI.'],
];

/**
 * One campaign. Public (no sign-in) at /campaigns/:id, and inside the creator app at /app/campaigns/:id.
 * Sign-in is only asked for when the visitor taps Participate.
 */
export default function CampaignDetail({ inApp }) {
  const { id } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isPending, error } = useQuery({ queryKey: ['campaign', id, user?.id], queryFn: () => api(`/campaigns/${id}`) });
  const social = useQuery({ queryKey: ['social'], queryFn: () => api('/social/accounts'), enabled: user?.role === 'creator' && Boolean(user?.onboarded) });
  const connectIg = useMutation({ mutationFn: () => startInstagramConnect(`/app/campaigns/${id}`) });
  const join = useMutation({
    mutationFn: () => api(`/campaigns/${id}/join`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaign', id] });
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      qc.invalidateQueries({ queryKey: ['my-campaigns'] });
    },
  });

  // Signed-in creators browse inside the app.
  if (!inApp && !loading && user?.role === 'creator' && user.onboarded) return <Navigate to={`/app/campaigns/${id}`} replace />;

  const back = inApp ? '/app/campaigns' : '/campaigns';
  const wrap = inApp ? 'pb-28 md:pb-0' : 'mx-auto max-w-5xl px-4 pb-36 pt-6 md:px-6 md:pb-16 md:pt-10';

  if (isPending) return <Spinner />;
  if (error) {
    return (
      <div className={wrap}>
        <Notice tone="danger" title="Campaign unavailable" action={<Button to={back} size="sm" variant="secondary">All campaigns</Button>}>
          {error.message}
        </Notice>
      </div>
    );
  }

  const c = data.campaign;
  const joined = c.joined || join.isSuccess;
  const days = daysLeft(c.endsAt);
  const notCreator = user && user.role && user.role !== 'creator';

  function participate() {
    const here = `/app/campaigns/${id}`;
    if (!user) {
      rememberNext(here);
      return navigate('/login?role=creator');
    }
    if (!user.role) {
      rememberNext(here);
      return navigate('/welcome');
    }
    if (user.role === 'creator' && !user.onboarded) {
      rememberNext(here);
      return navigate('/onboarding/creator');
    }
    join.mutate();
  }

  async function share() {
    const url = `${window.location.origin}/campaigns/${id}`;
    try {
      if (navigator.share) await navigator.share({ title: c.title, url });
      else await navigator.clipboard.writeText(url);
    } catch {
      /* cancelled */
    }
  }

  return (
    <div className={wrap}>
      <div className="mb-5 flex items-center justify-between">
        <Link to={back} className="inline-flex items-center gap-2 text-sm text-muted hover:text-text">
          <ArrowLeft className="size-4" aria-hidden /> All campaigns
        </Link>
        <button onClick={share} className="glass grid size-10 place-items-center rounded-full hover:bg-glass-2" aria-label="Share campaign">
          <Share2 className="size-4" aria-hidden />
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <div className="min-w-0">
          {/* Cover + stats */}
          <div className="glass rounded-3xl p-2">
            <div className="stripes relative aspect-[4/3] overflow-hidden rounded-[1.25rem] sm:aspect-[16/9]">
              {c.coverUrl && (
                <>
                  <img
                    src={img(c.coverUrl, 1400)}
                    srcSet={`${img(c.coverUrl, 700)} 700w, ${img(c.coverUrl, 1400)} 1400w`}
                    sizes="(min-width: 1024px) 640px, 100vw"
                    alt=""
                    className="absolute inset-0 size-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/70" aria-hidden />
                </>
              )}
              <div className="absolute inset-x-3 top-3 flex items-start justify-between">
                <div className="flex gap-1.5">
                  {c.platforms.map((p) => {
                    const Icon = PLATFORM_ICON[p];
                    return (
                      <span key={p} className="glass-solid grid size-9 place-items-center rounded-full">
                        <Icon className="size-[18px]" aria-label={p} />
                      </span>
                    );
                  })}
                </div>
                {joined ? <Status tone="success">Joined</Status> : <Status tone="live">Live</Status>}
              </div>
              <div className="absolute inset-x-4 bottom-4 text-white">
                <p className="text-[13px] opacity-80">{c.brand?.name}</p>
                <h1 className="mt-0.5 text-2xl font-semibold leading-tight drop-shadow md:text-[32px]">{c.title}</h1>
              </div>
            </div>
            <div className="grid grid-cols-4 px-1 py-3">
              {[
                [ratePer1k(c.ratePer1kPaise), 'per 1K'],
                [`${c.budgetLeftPct}%`, 'budget left'],
                [`${days}d`, 'to go'],
                [c.creators ?? 0, 'creators'],
              ].map(([v, k], i) => (
                <div key={k} className={i < 3 ? 'border-r border-border px-1 text-center' : 'px-1 text-center'}>
                  <p className="font-mono text-base font-medium tabular-nums md:text-lg">{v}</p>
                  <p className="font-mono text-[9px] uppercase tracking-wider text-muted md:text-[10px]">{k}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-1.5 px-1">
            <Tag>{c.type === 'ugc' ? 'Film your own' : 'Edit our footage'}</Tag>
            <Tag>{verticalLabel(c.vertical)}</Tag>
            {c.platforms.map((p) => (
              <Tag key={p}>{PLATFORM_NAME[p]}</Tag>
            ))}
          </div>

          {/* Submitting opens once the creator has joined (participated). */}
          {inApp && user?.role === 'creator' && joined && <CreatorClips campaign={c} />}

          {c.brief && (
            <section className="mt-8">
              <h2 className="mb-2.5 px-1 text-[15px] font-semibold">The brief</h2>
              <Card className="p-5 text-[15px] leading-relaxed text-muted">{c.brief}</Card>
            </section>
          )}

          {c.deliverables?.length > 0 && (
            <ListGroup title="What to post" className="mt-8">
              {c.deliverables.map((d) => (
                <ListRow key={d} icon={Video} title={d} />
              ))}
            </ListGroup>
          )}

          {c.gallery?.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-2.5 px-1 text-[15px] font-semibold">Inspiration</h2>
              <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 md:mx-0 md:px-0">
                {c.gallery.map((g, i) => (
                  <div key={g} className="glass w-40 shrink-0 snap-start rounded-3xl p-1.5 sm:w-48">
                    <img
                      src={img(g, 480)}
                      alt={`Reference ${i + 1} for ${c.title}`}
                      loading="lazy"
                      decoding="async"
                      className="aspect-[3/4] w-full rounded-[1.1rem] object-cover"
                    />
                  </div>
                ))}
              </div>
              <p className="mt-2 px-1 text-[13px] text-faint">Mood references from the brand. Make it your own.</p>
            </section>
          )}

          <ListGroup title="Footage" className="mt-8">
            {!joined ? (
              <ListRow icon={Lock} title="Unlocks when you participate" subtitle="Raw clips, logos and music from the brand" />
            ) : c.assetsUrl ? (
              <a href={c.assetsUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3.5 px-4 py-3.5 hover:bg-glass-2">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-glass-3">
                  <Download className="size-[18px]" strokeWidth={1.75} aria-hidden />
                </span>
                <span className="flex-1 text-sm font-medium">Download footage</span>
              </a>
            ) : (
              <ListRow icon={Download} title="Footage coming soon" subtitle="The brand will share the files here" />
            )}
          </ListGroup>

          {c.rules?.length > 0 && (
            <ListGroup title="Rules" className="mt-8">
              {c.rules.map((r) => (
                <ListRow key={r} icon={Check} title={r} />
              ))}
            </ListGroup>
          )}

          <section className="mt-8">
            <h2 className="mb-2.5 px-1 text-[15px] font-semibold">How it works</h2>
            <ol className="glass divide-y divide-border overflow-hidden rounded-3xl">
              {STEPS.map(([title, text], i) => (
                <li key={title} className="flex gap-3.5 px-4 py-3.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-glass-3 font-mono text-sm">{i + 1}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{title}</span>
                    <span className="mt-0.5 block text-[13px] text-muted">{text}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* Earnings, action and brand. Sticky on desktop. */}
        <aside className="lg:sticky lg:top-10">
          <Card className="p-5">
            <p className="text-[13px] text-muted">How you earn</p>
            <p className="mt-1 font-mono text-3xl font-medium tabular-nums">
              {ratePer1k(c.ratePer1kPaise)}
              <span className="ml-1.5 font-sans text-base font-normal text-muted">per 1,000 views</span>
            </p>
            <div className="mt-4 grid grid-cols-2 rounded-2xl bg-glass-2 shadow-[inset_0_1px_0_var(--glass-hi)]">
              <div className="border-r border-border p-3.5">
                <p className="font-mono text-base font-medium tabular-nums">{rupees(c.perClipCapPaise > 0 ? Math.min(c.ratePer1kPaise * 10, c.perClipCapPaise) : c.ratePer1kPaise * 10)}</p>
                <p className="label mt-0.5">at 10K views</p>
              </div>
              <div className="p-3.5">
                <p className="font-mono text-base font-medium tabular-nums">{c.perClipCapPaise > 0 ? rupees(c.perClipCapPaise) : 'No cap'}</p>
                <p className="label mt-0.5">max per clip</p>
              </div>
            </div>
            <div className="mt-5 hidden lg:block">
              <ParticipateButton joined={joined} join={join} onClick={participate} notCreator={notCreator} />
            </div>
            {joined && (
              <p className="mt-3 hidden text-center text-[13px] text-muted lg:block">
                <Upload className="mr-1 inline size-3.5" aria-hidden /> Posted your clip? Paste the link under the campaign photo.
              </p>
            )}
          </Card>

          <ListGroup className="mt-4">
            <ListRow icon={IndianRupee} title="Budget left" trailing={rupees(c.budgetLeftPaise)} />
            <ListRow icon={CalendarClock} title="Ends" trailing={new Date(c.endsAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} />
            <ListRow icon={Users} title="Creators joined" trailing={c.creators ?? 0} />
            <ListRow icon={ShieldCheck} title="Payout" subtitle="After approval and a 7-day view check" />
          </ListGroup>

          <ListGroup title="About the brand" className="mt-8">
            <ListRow icon={BadgeCheck} title={c.brand?.name} subtitle={`${verticalLabel(c.vertical)} · Verified by CreatorPerks`} />
            <ListRow icon={Link2} title="Share this campaign" onClick={share} />
          </ListGroup>

          {joined && social.data && social.data.accounts.length === 0 && (
            <Notice
              tone="warning"
              className="mt-4"
              title="Connect Instagram so your views count"
              action={
                <Button size="sm" loading={connectIg.isPending} disabled={!social.data.available?.instagram} onClick={() => connectIg.mutate()}>
                  Connect
                </Button>
              }
            >
              We track views on your connected account. No screenshots needed.
            </Notice>
          )}
          {join.error && <Notice tone="danger" className="mt-4">{join.error.message}</Notice>}
          {notCreator && (
            <Notice className="mt-4" title="Creator accounts only">
              You’re signed in as a {user.role}. Use a creator account to participate.
            </Notice>
          )}
        </aside>
      </div>

      {/* Phone: only the Participate bar here (the bottom nav is hidden on this page) */}
      <div className="fixed inset-x-0 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-20 px-4 lg:hidden">
        <div className="glass-solid rounded-full p-1.5">
          <ParticipateButton joined={joined} join={join} onClick={participate} notCreator={notCreator} />
        </div>
      </div>
    </div>
  );
}

function ParticipateButton({ joined, join, onClick, notCreator }) {
  if (joined) {
    return (
      <Button block size="lg" variant="secondary" disabled>
        <Check className="size-4" aria-hidden /> You’ve joined
      </Button>
    );
  }
  return (
    <Button block size="lg" arrow loading={join.isPending} onClick={onClick} disabled={notCreator}>
      Participate
    </Button>
  );
}
