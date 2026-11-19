import { Link, Outlet, useLocation } from 'react-router-dom';
import { Button, Logo } from '../ui';
import { homeFor, useAuth } from '../lib/auth';
import BottomNav, { usePublicNav } from './BottomNav';

export default function PublicLayout() {
  const { user } = useAuth();
  const nav = usePublicNav();
  const { pathname } = useLocation();
  return (
    <div className="min-h-dvh pb-tabbar md:pb-0">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/60 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
          <Link to="/" aria-label="CreatorPerks home">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Site">
            {[
              ['/campaigns', 'Campaigns'],
              ['/#how', 'How it works'],
              ['/#pricing', 'Pricing'],
              ['/#pilot', 'Request a pilot'],
            ].map(([href, label]) => (
              <a key={href} href={href} className="rounded-md px-3 py-2 text-sm text-muted hover:text-text">
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-1">
            {user ? (
              <Button to={homeFor(user)} size="sm" arrow>
                Open app
              </Button>
            ) : (
              <Button to="/login" size="sm" arrow>
                Sign in
              </Button>
            )}
          </div>
        </div>
      </header>
      <div key={pathname} className="page-enter">
        <Outlet />
      </div>
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 md:flex-row md:items-center md:justify-between md:px-6">
          <Logo />
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-muted">
            <Link to="/privacy" className="hover:text-text">Privacy</Link>
            <Link to="/terms" className="hover:text-text">Terms</Link>
            <Link to="/data-deletion" className="hover:text-text">Data deletion</Link>
            <span>© {new Date().getFullYear()} CreatorPerks · Pune, India</span>
          </div>
        </div>
      </footer>
      <BottomNav items={nav} />
    </div>
  );
}
