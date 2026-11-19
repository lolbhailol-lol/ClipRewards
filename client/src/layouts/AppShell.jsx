import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { Avatar, Logo, LogoMark, cx } from '../ui';
import BottomNav from './BottomNav';
import MenuDrawer from './MenuDrawer';
import SocialReturn from '../components/SocialReturn';

const COLLAPSE_KEY = 'cr_sidebar_collapsed';
const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
};

/**
 * App frame for every signed-in area.
 * Desktop (md+): glass sidebar on the left that can collapse to icons (remembered per browser).
 * Phones: glass top bar + floating glass bottom nav.
 *
 * nav:        [{ to, label, icon, end? }]
 * accountTo:  where the avatar links
 * section:    small label in the sidebar, e.g. "Creator"
 */
export default function AppShell({ nav, accountTo, section }) {
  const { user, signOut } = useAuth();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  useEffect(() => setMenuOpen(false), [pathname]);
  const displayName = user?.name || user?.email?.split('@')[0] || '';

  const toggle = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1');
      } catch {
        /* ignore */
      }
      return !c;
    });
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <div className={cx('min-h-dvh transition-[padding] duration-300', collapsed ? 'md:pl-[6.25rem]' : 'md:pl-[17rem]')}>
      <SocialReturn />
      {/* Desktop sidebar */}
      <aside
        className={cx(
          'fixed inset-y-3 left-3 z-30 hidden flex-col overflow-hidden rounded-3xl transition-[width] duration-300 md:flex glass-solid',
          collapsed ? 'w-[5rem]' : 'w-64'
        )}
      >
        <div className={cx('flex h-16 items-center', collapsed ? 'justify-center' : 'justify-between pl-5 pr-3')}>
          {!collapsed && (
            <Link to={nav[0].to} aria-label="Home">
              <Logo />
            </Link>
          )}
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="grid size-9 place-items-center rounded-xl text-muted transition-colors hover:bg-glass-2 hover:text-text"
          >
            <ToggleIcon className="size-[18px]" aria-hidden />
          </button>
        </div>
        {collapsed ? (
          <Link to={nav[0].to} aria-label="Home" className="mx-auto mb-3 mt-1">
            <LogoMark />
          </Link>
        ) : (
          <p className="label px-6 pb-2 pt-2">{section}</p>
        )}
        <nav className="flex-1 space-y-1 px-3" aria-label={section}>
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                cx(
                  'flex h-11 items-center gap-3 rounded-2xl text-sm font-medium transition-colors',
                  collapsed ? 'justify-center' : 'px-3.5',
                  isActive ? 'bg-glass-3 text-primary-text shadow-[inset_0_1px_0_var(--glass-hi)]' : 'text-muted hover:bg-glass-2 hover:text-text'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className="size-[18px] shrink-0" strokeWidth={isActive ? 2.2 : 1.75} aria-hidden />
                  {collapsed ? <span className="sr-only">{label}</span> : label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="p-3">
          {collapsed ? (
            <div className="flex flex-col items-center gap-1 rounded-2xl bg-glass-2 py-2">
              <Link to={accountTo} title={displayName} aria-label="Account" className="rounded-xl p-1 hover:bg-glass-3">
                <Avatar name={displayName} src={user?.avatarUrl} />
              </Link>
              <button onClick={signOut} title="Sign out" aria-label="Sign out" className="grid size-9 place-items-center rounded-xl text-muted hover:bg-glass-3 hover:text-text">
                <LogOut className="size-4" aria-hidden />
              </button>
            </div>
          ) : (
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
          )}
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

      {/* Uses the full laptop width; capped only on very wide monitors. */}
      <main className="pb-tabbar mx-auto max-w-[1440px] px-4 pt-6 md:px-8 md:pb-14 md:pt-10 xl:px-10">
        <div key={pathname} className="page-enter">
          <Outlet />
        </div>
      </main>

      <BottomNav items={nav} label={section} />
    </div>
  );
}
