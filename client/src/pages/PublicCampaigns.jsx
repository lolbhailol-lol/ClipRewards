import { Navigate, useSearchParams } from 'react-router-dom';
import { Megaphone } from 'lucide-react';
import { useAuth } from '../lib/auth';
import CampaignBrowser from '../components/CampaignBrowser';
import { Button } from '../ui';

/** Everyone can browse live campaigns. Sign-in is only needed to participate. */
export default function PublicCampaigns() {
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  const forBrands = params.get('for') === 'brands';

  if (!loading && user?.role === 'creator' && user.onboarded) return <Navigate to="/app/campaigns" replace />;

  const brandBanner = (
    <div className="glass flex flex-col gap-4 rounded-3xl p-5 sm:flex-row sm:items-center">
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-glass-3">
        <Megaphone className="size-[22px]" strokeWidth={1.75} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">Want creators to clip your content?</p>
        <p className="mt-0.5 text-sm text-muted">Launch a campaign like these. Set a rate per 1,000 views and pay only for real views.</p>
      </div>
      <Button to="/login?role=brand" arrow>
        Launch a campaign
      </Button>
    </div>
  );

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 md:px-6 md:pt-12">
      <div className="mb-8 fade-up">
        <p className="label">Live now</p>
        <h1 className="mt-3 text-[32px] font-semibold leading-tight md:text-5xl">
          <span className="text-faint">Pick a campaign.</span> Start earning.
        </h1>
        <p className="mt-3 max-w-xl text-muted">Browse every live campaign. You only need to sign in when you participate.</p>
      </div>

      {forBrands && <div className="mb-8">{brandBanner}</div>}

      <CampaignBrowser basePath="/campaigns" />

      {!forBrands && <div className="mt-12">{brandBanner}</div>}
    </main>
  );
}
