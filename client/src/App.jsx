import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Building2, ClipboardCheck, IndianRupee, LayoutDashboard, Megaphone } from 'lucide-react';
import { homeFor, rememberNext, useAuth } from './lib/auth';
import { Button, Logo, Spinner } from './ui';
import PublicLayout from './layouts/PublicLayout';
import AppShell from './layouts/AppShell';
import { CREATOR_NAV } from './layouts/BottomNav';
import Landing from './pages/Landing';
import PublicCampaigns from './pages/PublicCampaigns';
import CampaignDetail from './pages/CampaignDetail';
import { Privacy, Terms } from './pages/Legal';
import Login from './pages/Login';
import ChooseRole from './pages/ChooseRole';
import CreatorOnboarding from './pages/onboarding/CreatorOnboarding';
import BrandOnboarding from './pages/onboarding/BrandOnboarding';
import { Campaigns, Earnings, Home, Profile } from './pages/creator/CreatorPages';
import Insights from './pages/creator/Insights';
import { BrandAccount, BrandApprovals, BrandCampaigns, BrandOverview } from './pages/brand/BrandPages';
import { AdminBrands, AdminLeads, AdminOverview } from './pages/admin/AdminPages';
import { AdminCampaignEditor, AdminCampaigns } from './pages/admin/AdminCampaigns';
import { AdminClips, AdminPayouts } from './pages/admin/AdminClips';

const BRAND_NAV = [
  { to: '/brand', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/brand/campaigns', label: 'Campaigns', icon: Megaphone },
  { to: '/brand/approvals', label: 'Approvals', icon: ClipboardCheck },
];

const ADMIN_NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/campaigns', label: 'Campaigns', icon: Megaphone },
  { to: '/admin/clips', label: 'Clips', icon: ClipboardCheck },
  { to: '/admin/payouts', label: 'Payouts', icon: IndianRupee },
  { to: '/admin/brands', label: 'Brands', icon: Building2 },
];

/**
 * Gate a section by sign-in, role and onboarding.
 * - role: required role (null = must not have a role yet)
 * - onboarded: require onboarding to be finished
 */
function Gate({ role, onboarded = true, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!user) {
    rememberNext(location.pathname);
    return <Navigate to={role === 'brand' ? '/login?role=brand' : role === 'creator' ? '/login?role=creator' : '/login'} replace />;
  }
  if (role !== undefined && user.role !== role) return <Navigate to={homeFor(user)} replace />;
  if (onboarded && !user.onboarded) return <Navigate to={homeFor(user)} replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<Landing />} />
        <Route path="campaigns" element={<PublicCampaigns />} />
        <Route path="campaigns/:id" element={<CampaignDetail />} />
        <Route path="privacy" element={<Privacy />} />
        <Route path="terms" element={<Terms />} />
      </Route>
      <Route path="/login" element={<Login />} />

      <Route path="/welcome" element={<Gate role={null} onboarded={false}><ChooseRole /></Gate>} />
      <Route path="/onboarding/creator" element={<Gate role="creator" onboarded={false}><CreatorOnboarding /></Gate>} />
      <Route path="/onboarding/brand" element={<Gate role="brand" onboarded={false}><BrandOnboarding /></Gate>} />

      <Route path="/app" element={<Gate role="creator"><AppShell nav={CREATOR_NAV} accountTo="/app/profile" section="Creator" /></Gate>}>
        <Route index element={<Home />} />
        <Route path="campaigns" element={<Campaigns />} />
        <Route path="campaigns/:id" element={<CampaignDetail inApp />} />
        <Route path="insights" element={<Insights />} />
        <Route path="earnings" element={<Earnings />} />
        <Route path="profile" element={<Profile />} />
        <Route path="wallet" element={<Navigate to="/app/earnings" replace />} />
        <Route path="clips" element={<Navigate to="/app/campaigns" replace />} />
      </Route>

      <Route path="/brand" element={<Gate role="brand"><AppShell nav={BRAND_NAV} accountTo="/brand/account" section="Brand" /></Gate>}>
        <Route index element={<BrandOverview />} />
        <Route path="campaigns" element={<BrandCampaigns />} />
        <Route path="approvals" element={<BrandApprovals />} />
        <Route path="account" element={<BrandAccount />} />
        <Route path="billing" element={<Navigate to="/brand/account" replace />} />
      </Route>

      <Route path="/admin" element={<Gate role="admin"><AppShell nav={ADMIN_NAV} accountTo="/admin" section="Admin" /></Gate>}>
        <Route index element={<AdminOverview />} />
        <Route path="campaigns" element={<AdminCampaigns />} />
        <Route path="campaigns/new" element={<AdminCampaignEditor />} />
        <Route path="campaigns/:id" element={<AdminCampaignEditor />} />
        <Route path="clips" element={<AdminClips />} />
        <Route path="payouts" element={<AdminPayouts />} />
        <Route path="brands" element={<AdminBrands />} />
        <Route path="leads" element={<AdminLeads />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <Logo />
      <p className="font-mono text-sm text-faint">404</p>
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-muted">The link may be broken or the page may have moved.</p>
      <Button to="/" variant="secondary">Go home</Button>
    </div>
  );
}
