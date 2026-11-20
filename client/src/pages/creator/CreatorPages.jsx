import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownToLine,
  BarChart3,
  ChevronRight,
  CircleHelp,
  FileText,
  Film,
  History,
  IndianRupee,
  LogOut,
  Moon,
  Pencil,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { compact, rupees } from '../../lib/format';
import { startInstagramConnect } from '../../lib/social';
import { THEME_OPTIONS, useTheme } from '../../lib/theme';
import { InstagramIcon } from '../../ui/PlatformIcons';
import CampaignCard from '../../components/CampaignCard';
import CampaignBrowser, { useCampaigns } from '../../components/CampaignBrowser';
import SocialAccounts, { CheckPost, useSocialAccounts } from '../../components/SocialAccounts';
import { useInsights } from './Insights';
import { ClipList, HoldNote, useMySubmissions, useWallet } from '../../components/Clips';
import { Avatar, Button, Card, EmptyState, Field, Input, ListGroup, ListRow, Notice, PageHeader, Segmented, Skeleton, cx, toneClass } from '../../ui';

const MIN_WITHDRAW_PAISE = 20000; // ₹200

function useMyCampaigns() {
  return useQuery({ queryKey: ['my-campaigns'], queryFn: () => api('/campaigns/mine') });
}

/* ---------- Home ---------- */

export function Home() {
  const { user } = useAuth();
  const accounts = useSocialAccounts();
  const hasAccount = (accounts.data?.accounts ?? []).length > 0;
  const first = user?.name?.split(' ')[0] || 'there';
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  const wallet = useWallet();
  const clips = useMySubmissions();
  const w = wallet.data?.wallet;

  return (
    <div className="stagger space-y-8">
      <header className="flex items-center gap-3.5">
        <Avatar name={user?.name} src={user?.avatarUrl} className="size-12" />
        <div className="min-w-0">
          <p className="text-[13px] text-muted">{today}</p>
          <h1 className="truncate text-[26px] font-semibold leading-tight md:text-[30px]">Hi, {first}</h1>
        </div>
      </header>

      {!accounts.isPending && !hasAccount && <ConnectPrompt available={accounts.data?.available?.instagram} />}

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-[13px] text-muted">Earnings</p>
          <Button to="/app/earnings" variant="ghost" size="sm" className="-my-1.5 -mr-2">
            View all <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
          {[
            [rupees(w?.withdrawablePaise), 'Withdrawable'],
            [rupees(w?.onHoldPaise), 'On hold'],
            [String(clips.data?.submissions.length ?? 0), 'Clips'],
          ].map(([v, k]) => (
            <div key={k} className="min-w-0 rounded-2xl border border-border bg-glass-2 p-3 sm:p-4">
              <p className={cx('truncate font-mono text-lg font-medium tabular-nums sm:text-xl', toneClass(k))}>{v}</p>
              <p className="mt-1 truncate font-mono text-[10px] font-medium uppercase tracking-[0.02em] text-muted sm:text-[11px] sm:tracking-[0.08em]">{k === 'Withdrawable' ? (<><span className="sm:hidden">Available</span><span className="hidden sm:inline">Withdrawable</span></>) : k}</p>
            </div>
          ))}
        </div>
      </Card>

      {hasAccount && <InsightsSummary />}

      <LiveFeed />

      <MyCampaignsStrip />
    </div>
  );
}

function ConnectPrompt({ available }) {
  const connect = useMutation({ mutationFn: () => startInstagramConnect('/app') });
  return (
    <Card className="p-5">
      <div className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-fg">
          <InstagramIcon className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">Connect Instagram to start earning</p>
          <p className="mt-1 text-sm text-muted">We track your Reel views automatically, so you get paid without screenshots.</p>
        </div>
      </div>
      {connect.error && <Notice tone="danger" className="mt-4">{connect.error.message}</Notice>}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button arrow loading={connect.isPending} disabled={!available} onClick={() => connect.mutate()}>
          Connect Instagram
        </Button>
        <Button to="/app/profile" variant="ghost">
          Use YouTube instead
        </Button>
      </div>
    </Card>
  );
}

/** Live campaigns: swipeable row on phones, grid on desktop. */
function LiveFeed() {
  const { data, isPending } = useCampaigns();
  const campaigns = data?.campaigns ?? [];
  return (
    <section>
      <div className="mb-3 flex items-end justify-between px-1">
        <div>
          <h2 className="text-[17px] font-semibold">Live campaigns</h2>
          <p className="text-[13px] text-muted">{isPending ? 'Loading…' : `${campaigns.length} paying now`}</p>
        </div>
        <Button to="/app/campaigns" variant="ghost" size="sm" arrow>
          See all
        </Button>
      </div>
      {isPending ? (
        <Skeleton className="h-80" />
      ) : campaigns.length === 0 ? (
        <EmptyState icon={Film} title="No live campaigns right now">
          New paid campaigns show up here as soon as brands launch them.
        </EmptyState>
      ) : (
        <div className="stagger no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:scroll-px-0 md:grid md:grid-cols-2 md:gap-4 md:overflow-visible md:px-0 lg:grid-cols-3 2xl:grid-cols-4">
          {campaigns.slice(0, 6).map((c) => (
            <CampaignCard key={c.id} campaign={c} to={`/app/campaigns/${c.id}`} className="w-[78%] shrink-0 snap-start sm:w-[46%] md:w-auto" />
          ))}
        </div>
      )}
    </section>
  );
}

function MyCampaignsStrip() {
  const { data } = useMyCampaigns();
  const joined = data?.campaigns ?? [];
  if (!joined.length) return null;
  return (
    <ListGroup title="Your campaigns">
      {joined.slice(0, 4).map((c) => (
        <ListRow key={c.id} icon={Upload} title={c.title} subtitle={`${c.brand?.name} · ₹${c.ratePer1kPaise / 100} per 1K views`} to={`/app/campaigns/${c.id}`} />
      ))}
    </ListGroup>
  );
}

/** Last 30 days on the creator's main connected platform. */
function InsightsSummary() {
  const accounts = useSocialAccounts();
  const list = accounts.data?.accounts ?? [];
  const platform = list.find((a) => a.platform === 'instagram') ? 'instagram' : list[0]?.platform;
  const { data, isPending, error } = useInsights(platform, 30, Boolean(platform));
  if (!platform) return null;
  return (
    <Link to="/app/insights" className="glass block rounded-3xl p-5 transition-colors hover:bg-glass-2">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-muted">{platform === 'instagram' ? 'Instagram' : 'YouTube'} · last 30 days</p>
        <ChevronRight className="size-4 text-faint" aria-hidden />
      </div>
      {isPending ? (
        <Skeleton className="mt-3 h-12" />
      ) : error ? (
        <p className="mt-2 text-sm text-muted">{error.message}</p>
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-3">
          {(platform === 'instagram'
            ? [
                ['views', 'Views'],
                ['reach', 'Reach'],
                ['interactions', 'Interactions'],
              ]
            : [
                ['views', 'Views'],
                ['likes', 'Likes'],
                ['shorts', 'Shorts'],
              ]
          ).map(([k, label]) => (
            <div key={k}>
              <p className={cx("font-mono text-xl font-medium tabular-nums", toneClass(label))}>{data.totals[k] != null ? compact(data.totals[k]) : '—'}</p>
              <p className="label mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}
    </Link>
  );
}

/* ---------- Campaigns ---------- */

export function Campaigns() {
  const [view, setView] = useState('browse');
  const mine = useMyCampaigns();
  const joined = mine.data?.campaigns ?? [];

  return (
    <>
      <PageHeader eyebrow="Creator" title="Campaigns" subtitle="Pick a campaign, post your edit, earn for every 1,000 views." />
      <Segmented
        label="Campaign view"
        value={view}
        onChange={setView}
        className="mb-5 w-full sm:w-auto"
        options={[
          { value: 'browse', label: 'Live now' },
          { value: 'mine', label: 'Joined', count: mine.data ? joined.length : undefined },
        ]}
      />
      {view === 'browse' ? (
        <CampaignBrowser basePath="/app/campaigns" />
      ) : mine.isPending ? (
        <Skeleton className="h-64" />
      ) : joined.length === 0 ? (
        <EmptyState icon={Film} title="You haven’t joined any campaigns" action={<Button onClick={() => setView('browse')} variant="secondary">See live campaigns</Button>}>
          Open a campaign and tap Participate. Then post your clip and submit the link.
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {joined.map((c) => (
            <CampaignCard key={c.id} campaign={c} to={`/app/campaigns/${c.id}`} />
          ))}
        </div>
      )}
    </>
  );
}

/* ---------- Earnings ---------- */

export function Earnings() {
  const { user, setMe } = useAuth();
  const qc = useQueryClient();
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [view, setView] = useState('activity');
  const wallet = useWallet();
  const clips = useMySubmissions();
  const w = wallet.data?.wallet;
  const upi = user?.creator?.upiId;
  const min = w?.minWithdrawPaise ?? MIN_WITHDRAW_PAISE;

  const withdraw = useMutation({
    mutationFn: () => api('/submissions/wallet/withdraw', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wallet'] }),
    onError: (err) => {
      if (/UPI/.test(err.message)) setPayoutOpen(true);
    },
  });

  return (
    <>
      <PageHeader eyebrow="Creator" title="Earnings" />

      {/* Desktop: wallet + payout info on the left, activity on the right. Phones: one column. */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start xl:gap-10">
      <div>
      <Card className="p-5 md:p-6">
        <p className="text-[13px] text-muted">Withdrawable</p>
        {wallet.isPending ? (
          <Skeleton className="mt-2 h-12 w-40" />
        ) : (
          <p className="mt-1 font-mono text-[40px] font-medium leading-none tracking-tight tabular-nums text-c-money md:text-5xl">{rupees(w?.withdrawablePaise)}</p>
        )}
        <div className="mt-5 grid grid-cols-3 rounded-2xl bg-glass-2 shadow-[inset_0_1px_0_var(--glass-hi)]">
          {[
            [w?.onHoldPaise, 'On hold'],
            [w?.totalEarnedPaise, 'Total earned'],
            [w?.paidOutPaise, 'Paid out'],
          ].map(([v, k], i) => (
            <div key={k} className={i < 2 ? 'border-r border-border p-3.5' : 'p-3.5'}>
              <p className={cx("truncate font-mono text-base font-medium tabular-nums", toneClass(k))}>{rupees(v)}</p>
              <p className="label mt-0.5">{k}</p>
            </div>
          ))}
        </div>
        {w?.pendingWithdrawalPaise > 0 && (
          <Notice tone="warning" className="mt-4" title={`${rupees(w.pendingWithdrawalPaise)} on its way`}>
            Your withdrawal is being processed. It usually arrives within 1–2 working days.
          </Notice>
        )}
        <Button size="lg" block className="mt-5" loading={withdraw.isPending} disabled={!w || w.withdrawablePaise < min} onClick={() => (upi ? withdraw.mutate() : setPayoutOpen(true))}>
          <ArrowDownToLine className="size-4" aria-hidden /> Withdraw {w?.withdrawablePaise >= min ? rupees(w.withdrawablePaise) : ''} to UPI
        </Button>
        {withdraw.error && <Notice tone="danger" className="mt-3">{withdraw.error.message}</Notice>}
        {withdraw.isSuccess && <Notice tone="success" className="mt-3" title="Withdrawal requested">We’ll send it to {upi} soon.</Notice>}
        <p className="mt-2 text-center text-xs text-faint">You can withdraw once you have {rupees(min)} or more.</p>
      </Card>

      <ListGroup title="Payout method" className="mt-8">
        {payoutOpen ? (
          <UpiForm
            initial={upi}
            onDone={(u) => {
              if (u) setMe({ user: u });
              setPayoutOpen(false);
            }}
          />
        ) : (
          <ListRow icon={IndianRupee} title={upi ? 'UPI ID' : 'Add a UPI ID'} subtitle={upi || 'You’ll need it for your first withdrawal'} onClick={() => setPayoutOpen(true)} />
        )}
      </ListGroup>

      <ListGroup title="How payouts work" className="mt-8">
        <ListRow icon={Upload} title="Clip approved" subtitle="We check your clip against the brief" />
        <ListRow icon={ShieldCheck} title="7-day view check" subtitle="Views are checked for bots before they count" />
        <ListRow icon={ArrowDownToLine} title="Withdraw to UPI" subtitle={`From ${rupees(min)}, usually within 1–2 working days`} />
      </ListGroup>
      </div>

      <section>
        <Segmented
          label="Earnings view"
          value={view}
          onChange={setView}
          className="mb-3 w-full sm:w-auto"
          options={[
            { value: 'activity', label: 'Activity' },
            { value: 'clips', label: 'Your clips', count: clips.data ? clips.data.submissions.length : undefined },
          ]}
        />
        {view === 'clips' ? (
          <ClipList
            showCampaign
            submissions={clips.data?.submissions}
            empty={
              <EmptyState icon={Upload} title="No clips yet" action={<Button to="/app/campaigns" variant="secondary">Find a campaign</Button>}>
                Open a campaign, post your clip, then paste the link to submit it.
              </EmptyState>
            }
          />
        ) : !wallet.data?.activity?.length ? (
          <EmptyState icon={History} title="No activity yet">
            Earnings from approved clips and your withdrawals will appear here.
          </EmptyState>
        ) : (
          <div className="glass divide-y divide-border overflow-hidden rounded-3xl">
            {wallet.data.activity.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-3.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-glass-3">
                  {a.kind === 'withdrawal' ? <ArrowDownToLine className="size-[18px]" strokeWidth={1.75} aria-hidden /> : <IndianRupee className="size-[18px]" strokeWidth={1.75} aria-hidden />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{a.title}</span>
                  <span className="block truncate text-[13px] text-muted">
                    {a.detail}
                    {a.onHold && ` · on hold until ${new Date(a.availableAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
                  </span>
                </span>
                <span className={`shrink-0 font-mono text-sm tabular-nums ${a.amountPaise < 0 ? 'text-muted' : 'text-success'}`}>
                  {a.amountPaise < 0 ? '−' : '+'}
                  {rupees(Math.abs(a.amountPaise))}
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="mt-2">
          <HoldNote />
        </div>
      </section>
      </div>
    </>
  );
}

function UpiForm({ initial = '', onDone }) {
  const [upiId, setUpiId] = useState(initial);
  const save = useMutation({
    mutationFn: () => api('/onboarding/payout', { method: 'PUT', body: { upiId } }),
    onSuccess: ({ user }) => onDone(user),
  });
  return (
    <form
      className="space-y-3 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <Field label="UPI ID" hint="Payouts are sent here. Check it carefully.">
        {(p) => <Input {...p} autoFocus required autoCapitalize="none" autoCorrect="off" placeholder="name@okicici" value={upiId} onChange={(e) => setUpiId(e.target.value.trim())} />}
      </Field>
      {save.error && <Notice tone="danger">{save.error.message}</Notice>}
      <div className="flex gap-2">
        <Button type="submit" loading={save.isPending}>
          Save
        </Button>
        <Button type="button" variant="ghost" onClick={() => onDone(null)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/* ---------- Profile ---------- */

export function Profile() {
  const { user, setMe, signOut } = useAuth();
  const [theme, setTheme] = useTheme();
  const [editing, setEditing] = useState(false);

  return (
    <>
    <PageHeader eyebrow="Creator" title="Profile" />
    {/* Desktop: you + preferences on the left, connected accounts on the right. Phones: one column. */}
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start xl:gap-x-10">
      <Card className="flex flex-col items-center px-5 py-7 text-center">
        <Avatar name={user?.name} src={user?.avatarUrl} className="size-20 text-xl" />
        {editing ? (
          <NameForm
            initial={user?.name}
            onDone={(u) => {
              if (u) setMe({ user: u });
              setEditing(false);
            }}
          />
        ) : (
          <>
            <p className="mt-4 text-lg font-semibold">{user?.name}</p>
            <p className="text-sm text-muted">{user?.email}</p>
            <Button variant="secondary" size="sm" className="mt-4" onClick={() => setEditing(true)}>
              <Pencil className="size-3.5" aria-hidden /> Edit name
            </Button>
          </>
        )}
      </Card>

      {/* Rendered once; on desktop it moves to the right column, spanning the left column’s rows. */}
      <div className="space-y-8 lg:col-start-2 lg:row-span-3 lg:row-start-1">
        <SocialAccounts />
        <CheckPost />
      </div>

      <ListGroup title="Preferences">
        <div className="flex items-center gap-3.5 px-4 py-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-glass-3">
            <Moon className="size-[18px]" strokeWidth={1.75} aria-hidden />
          </span>
          <span className="flex-1 text-sm font-medium">Theme</span>
          <Segmented label="Theme" value={theme} onChange={setTheme} options={THEME_OPTIONS} />
        </div>
      </ListGroup>

      <ListGroup title="More">
        <ListRow icon={IndianRupee} title="Payout method" subtitle={user?.creator?.upiId || 'Added when you withdraw'} to="/app/earnings" />
        <ListRow icon={BarChart3} title="Insights" to="/app/insights" />
        <ListRow icon={CircleHelp} title="Help & FAQ" to="/#pilot" />
        <ListRow icon={FileText} title="Privacy Policy" to="/privacy" />
        <ListRow icon={FileText} title="Terms of Service" to="/terms" />
        <ListRow icon={LogOut} title="Sign out" tone="danger" onClick={signOut} />
      </ListGroup>
    </div>
    </>
  );
}

function NameForm({ initial = '', onDone }) {
  const [name, setName] = useState(initial);
  const save = useMutation({
    mutationFn: () => api('/onboarding/creator', { method: 'POST', body: { name } }),
    onSuccess: ({ user }) => onDone(user),
  });
  return (
    <form
      className="mt-4 w-full max-w-xs space-y-3 text-left"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <Field label="Name">{(p) => <Input {...p} autoFocus required minLength={2} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
      {save.error && <Notice tone="danger">{save.error.message}</Notice>}
      <div className="flex gap-2">
        <Button type="submit" block loading={save.isPending}>
          Save
        </Button>
        <Button type="button" variant="ghost" onClick={() => onDone(null)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
