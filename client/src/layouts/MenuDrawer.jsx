import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { ChevronRight, CircleHelp, FileText, Moon, ShieldCheck, X } from 'lucide-react';
import { THEME_OPTIONS, useTheme } from '../lib/theme';
import { Avatar, Segmented } from '../ui';

const LINKS = [
  { to: '/#pilot', label: 'Help & FAQ', icon: CircleHelp },
  { to: '/privacy', label: 'Privacy Policy', icon: ShieldCheck },
  { to: '/terms', label: 'Terms of Service', icon: FileText },
];

/**
 * Phone menu (☰): your profile, theme, and help/legal links. Pages live in the bottom bar.
 */
export default function MenuDrawer({ open, onClose, accountTo }) {
  const [theme, setTheme] = useTheme();
  const { user } = useAuth();
  const name = user?.name || user?.email?.split('@')[0] || '';

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
      <button type="button" aria-label="Close menu" onClick={onClose} className="fade-in absolute inset-0 bg-black/55 backdrop-blur-[2px]" />
      <aside className="sheet-in glass-solid absolute right-2 top-2 w-[min(20rem,calc(100%-2.5rem))] rounded-[2rem] p-3">
        <div className="flex items-center justify-between px-2 pb-1 pt-1">
          <span className="label">Menu</span>
          <button type="button" onClick={onClose} aria-label="Close menu" className="grid size-10 place-items-center rounded-full hover:bg-glass-2">
            <X className="size-5" aria-hidden />
          </button>
        </div>

        {accountTo && (
          <Link to={accountTo} onClick={onClose} className="mb-2 flex items-center gap-3 rounded-3xl bg-glass-2 p-3 shadow-[inset_0_1px_0_var(--glass-hi)] hover:bg-glass-3">
            <Avatar name={name} src={user?.avatarUrl} className="size-11" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{name}</span>
              <span className="block truncate text-[13px] text-muted">{user?.email}</span>
            </span>
            <ChevronRight className="size-4 text-faint" aria-hidden />
          </Link>
        )}

        <div className="stagger space-y-1">
          <div className="rounded-2xl px-3.5 py-2.5">
            <div className="flex items-center gap-3">
              <Moon className="size-5 shrink-0 text-muted" strokeWidth={1.75} aria-hidden />
              <span className="text-[15px]">Theme</span>
            </div>
            <Segmented label="Theme" value={theme} onChange={setTheme} options={THEME_OPTIONS} className="mt-2.5 w-full" />
          </div>
          {LINKS.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} onClick={onClose} className="flex h-12 items-center gap-3 rounded-2xl px-3.5 text-[15px] hover:bg-glass-2">
              <Icon className="size-5 text-muted" strokeWidth={1.75} aria-hidden />
              <span className="flex-1">{label}</span>
              <ChevronRight className="size-4 text-faint" aria-hidden />
            </Link>
          ))}
        </div>
      </aside>
    </div>
  );
}
