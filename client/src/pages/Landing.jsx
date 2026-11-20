import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { api } from '../lib/api';
import { VERTICALS } from '../lib/format';
import CampaignCard from '../components/CampaignCard';
import { useCampaigns } from '../components/CampaignBrowser';
import { Button, Card, Field, Input, Notice, Segmented, Select, Textarea, cx } from '../ui';

const STEPS = {
  brands: [
    ['Set a brief and a budget', 'Share your footage or product, pick a rate per 1,000 views and a budget. We help you set up the first one.'],
    ['Creators post edited clips', 'Verified Indian creators turn it into Reels and Shorts on their own accounts, with #ad disclosure.'],
    ['Pay only for real views', 'You approve every clip. Views are checked for bots, and you only pay for what passes.'],
  ],
  creators: [
    ['Pick a campaign', 'Browse paid campaigns, download the footage and read the brief. No follower minimum.'],
    ['Post your edit', 'Add your hook and captions, post on Instagram or YouTube, and submit the link.'],
    ['Get paid per 1,000 views', 'Earnings grow with your views. Withdraw to UPI once the 7-day check clears.'],
  ],
};

const CATEGORIES = [
  ['Gen Z & college', 'App, D2C and edtech launches for 18–24 India.'],
  ['Podcasts & interviews', 'Turn long episodes into a steady stream of short clips.'],
  ['Music', 'Song hooks and trend edits around a release.'],
  ['Regional language', 'Marathi, Hindi and more for tier-2 and tier-3 reach.'],
];

const FAQ = [
  ['How do you stop fake views?', 'Every clip is checked: engagement compared with views, sudden spikes, account age, and one account per person. Earnings are held for 7 days before payout, and suspicious views are removed.'],
  ['Do I approve the clips?', 'Yes. Nothing is paid until you or our team approve the clip against your brief and brand rules.'],
  ['Which platforms?', 'Instagram Reels and YouTube Shorts, posted on Indian creators’ own accounts.'],
  ['What does it cost?', 'You set a rate per 1,000 views and a budget, and pay only for verified views. No subscription or setup fee. A small platform fee is shown before you launch, and early brands get their first pilot fee-free.'],
  ['How do creators get paid?', 'Earnings from approved clips move to their wallet after the 7-day hold, then they withdraw to UPI.'],
];

const EXAMPLE = {
  brand: 'Example brand',
  title: 'Campus app launch clips',
  coverUrl: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644',
  ratePer1kPaise: 5000,
  budgetLeftPct: 68,
  daysLeft: 5,
  platforms: ['instagram', 'youtube'],
  type: 'clipping',
  vertical: 'genz',
};

function Section({ id, eyebrow, title, children, className }) {
  return (
    <section id={id} className={cx('scroll-mt-16 border-t border-border', className)}>
      <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
        <p className="label">{eyebrow}</p>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold md:text-4xl">{title}</h2>
        <div className="mt-10 md:mt-12">{children}</div>
      </div>
    </section>
  );
}

export default function Landing() {
  const [side, setSide] = useState('brands');
  const { data } = useCampaigns();
  const live = data?.campaigns ?? [];

  return (
    <main>
      {/* Hero with animated rings */}
      <section className="relative overflow-hidden">
        {/* Big faint rings around the headline, each with one light travelling around it. */}
        <div className="hero-rings top-[24rem] md:top-[30rem]" aria-hidden>
          <span className="hero-ring hero-ring--fill" style={{ width: 'min(1180px, 150vw)', height: 'min(1180px, 150vw)', '--dur': '18s' }} />
          <span className="hero-ring hero-ring--white hidden md:block" style={{ width: 840, height: 840, '--dur': '26s', '--dir': 'reverse' }} />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 pb-10 pt-14 md:px-6 md:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="fade-up label">Pay-per-view clipping · India</p>
            <h1
              className="fade-up mt-5 text-[40px] font-semibold leading-[1.05] tracking-[-0.035em] sm:text-6xl md:text-7xl"
              style={{ animationDelay: '80ms' }}
            >
              <span className="text-faint">Creators earn on</span> <span className="grad">views.</span>
              <br />
              <span className="text-faint">Brands pay for</span> <span className="grad">results.</span>
            </h1>
            <p className="fade-up mx-auto mt-6 max-w-xl text-[17px] leading-relaxed text-muted" style={{ animationDelay: '160ms' }}>
              Brands set a rate per 1,000 views. Creators post edited Reels and Shorts. Every clip is approved, and only real views are paid.
            </p>
            <div className="fade-up mx-auto mt-9 flex max-w-md flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center" style={{ animationDelay: '240ms' }}>
              <Button to="/campaigns?for=brands" size="lg" arrow>
                Launch a campaign
              </Button>
              <Button to="/campaigns" size="lg" variant="secondary" arrow>
                Start earning
              </Button>
            </div>
            <p className="fade-up mt-5 text-[13px] text-muted" style={{ animationDelay: '320ms' }}>
              Browse live campaigns free. Sign in only when you participate.
            </p>
          </div>

          {/* Floating tilted cards */}
          <div className="relative mx-auto mt-14 flex max-w-5xl items-start justify-center gap-6 md:mt-20">
            <div className="float-card hidden w-72 md:block" style={{ '--tilt': '-7deg', marginTop: '3rem' }}>
              <CampaignCard campaign={live[1] ?? EXAMPLE} example={!live[1]} to={live[1] ? `/campaigns/${live[1].id}` : undefined} />
            </div>
            <div className="float-card w-full max-w-[19rem]" style={{ '--tilt': '-4deg', animationDelay: '-2s' }}>
              <CampaignCard campaign={live[0] ?? EXAMPLE} example={!live[0]} to={live[0] ? `/campaigns/${live[0].id}` : undefined} />
            </div>
            <div className="float-card hidden w-72 lg:block" style={{ '--tilt': '6deg', marginTop: '4rem', animationDelay: '-4s' }}>
              <Card className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <p className="text-sm font-medium">Campaign report</p>
                  <span className="label">Example</span>
                </div>
                <div className="grid grid-cols-2">
                  {[
                    ['4.2L', 'Views'],
                    ['₹21,000', 'Spend'],
                    ['₹50', 'Cost / 1K'],
                    ['38', 'Clips'],
                  ].map(([v, k], i) => (
                    <div key={k} className={cx('p-4', i % 2 === 0 && 'border-r border-border', i < 2 && 'border-b border-border')}>
                      <p className="font-mono text-lg font-medium tabular-nums">{v}</p>
                      <p className="label mt-0.5">{k}</p>
                    </div>
                  ))}
                </div>
                <div className="flex h-20 items-end gap-1 border-t border-border p-4" aria-hidden>
                  {[18, 26, 22, 40, 52, 47, 63, 58, 71, 84, 78, 92].map((h, i) => (
                    <div key={i} className="flex-1 rounded-sm bg-text/80" style={{ height: `${h}%` }} />
                  ))}
                </div>
              </Card>
            </div>
          </div>
          <div className="mt-10 text-center">
            <Button to="/campaigns" variant="ghost" size="sm" arrow>
              See all live campaigns
            </Button>
          </div>
        </div>
      </section>

      {/* Scrolling strip */}
      <div className="marquee overflow-hidden border-y border-border py-5" aria-hidden>
        <div className="marquee__track">
          {[0, 1].map((k) => (
            <div key={k} className="flex shrink-0 items-center">
              {['Instagram Reels', 'YouTube Shorts', 'Pay per 1,000 views', 'Gen Z & college', 'Podcasts', 'Music', 'Marathi · Hindi · Tamil', 'Verified views', 'UPI payouts', 'Brand-approved clips'].map((t) => (
                <span key={t} className="flex items-center gap-6 px-6 text-lg font-medium text-muted md:text-xl">
                  {t}
                  <span className="size-1.5 rounded-full bg-faint" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <Section id="how" eyebrow="How it works" title="One brief. Many creators. You pay only for views that are real.">
        <Segmented
          label="Show steps for"
          value={side}
          onChange={setSide}
          options={[
            { value: 'brands', label: 'For brands' },
            { value: 'creators', label: 'For creators' },
          ]}
        />
        <ol className="mt-6 grid gap-3 md:grid-cols-3">
          {STEPS[side].map(([title, text], i) => (
            <li key={title} className="glass rounded-3xl p-5 md:p-6">
              <p className="font-mono text-sm text-faint">0{i + 1}</p>
              <p className="mt-6 font-medium md:mt-10">{title}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-6">
          <Button to={side === 'brands' ? '/campaigns?for=brands' : '/campaigns'} variant="secondary" arrow>
            {side === 'brands' ? 'Launch a campaign' : 'Browse campaigns'}
          </Button>
        </div>
      </Section>

      {/* Categories */}
      <Section eyebrow="Categories" title="Built for what India watches.">
        <ul className="divide-y divide-border border-y border-border">
          {CATEGORIES.map(([title, text], i) => (
            <li key={title} className="grid grid-cols-[2.5rem_1fr] gap-x-4 py-5 md:grid-cols-[4rem_1fr_1.4fr] md:items-baseline md:py-6">
              <span className="font-mono text-sm text-faint">0{i + 1}</span>
              <p className="text-lg font-medium md:text-xl">{title}</p>
              <p className="col-start-2 mt-1 text-sm text-muted md:col-start-3 md:mt-0">{text}</p>
            </li>
          ))}
        </ul>
      </Section>

      {/* Pricing */}
      <Section id="pricing" eyebrow="Pricing" title="Pay per 1,000 views. That’s it.">
        <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
          <div className="glass flex flex-col rounded-3xl p-6 md:p-8">
            <p className="text-sm text-muted">You set the rate (CPM)</p>
            <p className="mt-2 font-mono text-5xl font-medium tracking-tight md:text-6xl">
              ₹30–₹100
              <span className="mt-1 block font-sans text-base font-normal text-muted sm:ml-2 sm:mt-0 sm:inline">per 1,000 views</span>
            </p>
            <p className="mt-3 max-w-md text-sm text-muted">
              Pick a rate and a budget. You only pay for verified views on clips you approved. When the budget runs out, the campaign stops. No surprises.
            </p>
            <ul className="mt-6 grid gap-2.5 text-sm sm:grid-cols-2">
              {['No subscription', 'No setup fee', 'Pay only for verified views', 'Approve every clip', 'Cap per clip, so no single post eats the budget', 'Unused budget comes back to you'].map((pt) => (
                <li key={pt} className="flex gap-2.5">
                  <span className="mt-2 size-1 shrink-0 rounded-full bg-text" aria-hidden />
                  {pt}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <Button to="/campaigns?for=brands" arrow>
                Launch a campaign
              </Button>
            </div>
          </div>

          <div className="glass rounded-3xl p-6 md:p-8">
            <p className="text-sm text-muted">Example</p>
            <dl className="mt-4 divide-y divide-border">
              {[
                ['Budget', '₹25,000'],
                ['Rate', '₹50 per 1,000 views'],
                ['You get', 'up to 5,00,000 views'],
                ['Cost per view', '₹0.05'],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-4 py-3">
                  <dt className="text-sm text-muted">{k}</dt>
                  <dd className="text-right font-mono text-base font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs text-faint">A small platform fee is added to your budget and shown before you launch. Early brands get their first pilot fee-free.</p>
          </div>
        </div>
      </Section>

      {/* Pilot form + FAQ */}
      <Section id="pilot" eyebrow="Get started" title="Request a pilot.">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <p className="max-w-md text-muted">
              Tell us about your brand. We’ll reply within one working day with a plan and three sample clips made from your footage.
            </p>
            <div className="mt-10">
              <p className="label mb-2">Questions</p>
              <div className="divide-y divide-border border-y border-border">
                {FAQ.map(([q, a]) => (
                  <details key={q} className="group">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[15px] font-medium">
                      {q}
                      <Plus className="size-4 shrink-0 text-muted transition-transform group-open:rotate-45" aria-hidden />
                    </summary>
                    <p className="pb-5 pr-8 text-sm leading-relaxed text-muted">{a}</p>
                  </details>
                ))}
              </div>
            </div>
          </div>
          <LeadForm />
        </div>
      </Section>
    </main>
  );
}

function LeadForm() {
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '', vertical: 'genz', budget: '₹10K–25K', message: '', website: '' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = useMutation({ mutationFn: () => api('/leads', { method: 'POST', body: form }) });

  if (submit.isSuccess) {
    return (
      <Notice tone="success" title="Thanks, we’ve got it" className="self-start">
        We’ll email {form.email} within one working day with a plan and sample clips.
      </Notice>
    );
  }

  return (
    <Card className="self-start p-5 md:p-6">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit.mutate();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Your name">{(p) => <Input {...p} required autoComplete="name" value={form.name} onChange={set('name')} />}</Field>
          <Field label="Company / brand">{(p) => <Input {...p} required autoComplete="organization" value={form.company} onChange={set('company')} />}</Field>
          <Field label="Work email">{(p) => <Input {...p} type="email" required autoComplete="email" value={form.email} onChange={set('email')} />}</Field>
          <Field label="Phone" optional>{(p) => <Input {...p} type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} />}</Field>
          <Field label="Category">
            {(p) => (
              <Select {...p} value={form.vertical} onChange={set('vertical')}>
                {VERTICALS.map((v) => (
                  <option key={v.value} value={v.value}>{v.label}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Pilot budget">
            {(p) => (
              <Select {...p} value={form.budget} onChange={set('budget')}>
                {['Under ₹10K', '₹10K–25K', '₹25K–1L', '₹1L+', 'Not sure yet'].map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Field label="What do you want to promote?" optional>
          {(p) => <Textarea {...p} value={form.message} onChange={set('message')} placeholder="Product, launch date, the audience you want…" />}
        </Field>
        {/* Honeypot for bots; hidden from people and screen readers. */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} className="hidden" aria-hidden />
        {submit.error && <Notice tone="danger">{submit.error.message}</Notice>}
        <Button type="submit" size="lg" block loading={submit.isPending} arrow>
          Request a pilot
        </Button>
        <p className="text-center text-xs text-muted">No payment needed.</p>
      </form>
    </Card>
  );
}
