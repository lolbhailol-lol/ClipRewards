import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { LogOut, Menu } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { Avatar, Logo, cx } from '../ui';
import BottomNav from './BottomNav';
import MenuDrawer from './MenuDrawer';
import SocialReturn from '../components/SocialReturn';

/**
 * App frame for every signed-in area.
 * Desktop (md+): glass sidebar on the left.
 * Phones: glass top bar + floating glass bottom nav.
 *
 * nav:        [{ to, label, icon, end? }]  (3–4 items so the bottom bar fits)
 * accountTo:  where the avatar links
 * section:    small label in the sidebar, e.g. "Creator"
 */
export default function AppShell({ nav, accountTo, section }) {
  const { user, signOut } = useAuth();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  useEffect(() => setMenuOpen(false), [pathname]);
  const displayName = user?.name || user?.email?.split('@')[0] || '';

  return (
    <div className="min-h-dvh md:pl-[17rem]">
      <SocialReturn />
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-3 left-3 hidden w-64 flex-col rounded-3xl md:flex glass-solid">
        <div className="flex h-16 items-center px-5">
          <Link to={nav[0].to} aria-label="Home">
            <Logo />
          </Link>
        </div>
        <p className="label px-6 pb-2 pt-2">{section}</p>
        <nav className="flex-1 space-y-1 px-3" aria-label={section}>
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cx(
                  'flex h-11 items-center gap-3 rounded-2xl px-3.5 text-sm font-medium transition-colors',
                  isActive ? 'bg-glass-3 text-text shadow-[inset_0_1px_0_var(--glass-hi)]' : 'text-muted hover:bg-glass-2 hover:text-text'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className="size-[18px]" strokeWidth={isActive ? 2.2 : 1.75} aria-hidden />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="p-3">
          <div className="rounded-2xl bg-glass-2 p-2">
            <Link to={accountTo} className="flex items-center gap-3 rounded-xl p-1.5 hover:bg-glass-3">
              <Avatar name={displayName} src={user?.avatarUrl} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{displayName}</span>
                <span className="block truncate text-xs text-muted">{user?.email}</span>
              </span>
            </Link>
            <button
              onClick={signOut}
              className="mt-1 flex h-9 w-full items-center gap-2.5 rounded-xl px-2.5 text-[13px] text-muted hover:bg-glass-3 hover:text-text"
            >
              <LogOut className="size-4" aria-hidden /> Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Phone top bar: just the logo and the menu, straight on the background */}
      <header className="sticky top-0 z-30 bg-gradient-to-b from-bg via-bg/80 to-transparent px-4 pb-3 pt-3 md:hidden">
        <div className="flex h-12 items-center justify-between">
          <Link to={nav[0].to} aria-label="ClipRewards home" className="transition-transform active:scale-95">
            <Logo className="text-base" />
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            className="-mr-2 grid size-11 place-items-center rounded-full transition-colors hover:bg-glass-2 active:scale-95"
          >
            <Menu className="size-6" aria-hidden />
          </button>
        </div>
      </header>
      <MenuDrawer open={menuOpen} onClose={closeMenu} accountTo={accountTo} />

      <main className="pb-tabbar mx-auto max-w-5xl px-4 pt-6 md:px-8 md:pb-14 md:pt-10">
        <div key={pathname} className="page-enter">
          <Outlet />
        </div>
      </main>

      <BottomNav items={nav} label={section} />
    </div>
  );
}
