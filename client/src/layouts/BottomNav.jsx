import { NavLink, matchPath, useLocation } from 'react-router-dom';
import { BarChart3, Film, House, LayoutDashboard, LayoutGrid, UserRound, Wallet } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { cx } from '../ui';

export const CREATOR_NAV = [
  { to: '/app', label: 'Home', icon: House, end: true },
  { to: '/app/campaigns', label: 'Campaigns', icon: LayoutGrid },
  { to: '/app/clips', label: 'Clips', icon: Film },
  { to: '/app/insights', label: 'Insights', icon: BarChart3 },
  { to: '/app/earnings', label: 'Earnings', icon: Wallet },
];

/** Nav for public pages (landing, public campaigns, sign-in), based on who is looking. */
export function usePublicNav() {
  const { user } = useAuth();
  if (user?.role === 'creator' && user.onboarded) return CREATOR_NAV;
  if (user?.role === 'brand') {
    return [
      { to: '/', label: 'Home', icon: House, end: true },
      { to: '/campaigns', label: 'Campaigns', icon: LayoutGrid },
      { to: '/brand', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/brand/account', label: 'Account', icon: UserRound },
    ];
  }
  if (user?.role === 'admin') {
    return [
      { to: '/', label: 'Home', icon: House, end: true },
      { to: '/campaigns', label: 'Campaigns', icon: LayoutGrid },
      { to: '/admin', label: 'Admin', icon: LayoutDashboard },
    ];
  }
  // Signed out: browsing is open; Earnings/Profile ask to sign in, then come back.
  return [
    { to: '/', label: 'Home', icon: House, end: true },
    { to: '/campaigns', label: 'Campaigns', icon: LayoutGrid },
    { to: '/app/earnings', label: 'Earnings', icon: Wallet },
    { to: '/app/profile', label: 'Profile', icon: UserRound },
  ];
}

/** Rounded glass bottom nav floating just above the bottom edge. Phones only (sidebar takes over at md+ in the app). */
export default function BottomNav({ items, label = 'Main', className }) {
  const { pathname } = useLocation();
  // A single campaign page shows only its Participate bar instead.
  if (matchPath('/campaigns/:id', pathname) || matchPath('/app/campaigns/:id', pathname)) return null;
  const active = items.findIndex((it) => matchPath({ path: it.to, end: Boolean(it.end) }, pathname));
  return (
    <nav aria-label={label} className={cx('fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 md:hidden', className)}>
      <ul className="glass-solid relative flex rounded-[2rem] p-1.5 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.7)]">
        {/* One highlight that slides to the active tab. */}
        {active >= 0 && (
          <li
            aria-hidden
            className="pointer-events-none absolute inset-y-1.5 left-1.5 rounded-[1.6rem] bg-glass-3 shadow-[inset_0_1px_0_var(--glass-hi)] transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none"
            style={{ width: `calc((100% - 0.75rem) / ${items.length})`, transform: `translateX(${active * 100}%)` }}
          />
        )}
        {items.map(({ to, label: text, icon: Icon, end }) => (
          <li key={to} className="relative flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cx(
                  'flex h-[3.4rem] flex-col items-center justify-center gap-1 rounded-[1.6rem] text-[11px] font-medium transition-colors active:scale-95',
                  isActive ? 'text-primary' : 'text-faint hover:text-muted'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={cx('size-[21px] transition-transform duration-300', isActive && '-translate-y-0.5')} strokeWidth={isActive ? 2.2 : 1.75} aria-hidden />
                  {text}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
