import { Children, forwardRef, useId } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronRight, Loader2 } from 'lucide-react';
import CountUp from '../components/CountUp';
import IdentityIcon from '../components/IdentityIcon';

const cx = (...c) => c.filter(Boolean).join(' ');
export { cx };

/* ---------------- Buttons ---------------- */

const BUTTON = {
  base: 'inline-flex items-center justify-center gap-2 rounded-full font-medium transition-[background,opacity,transform] active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none select-none whitespace-nowrap',
  size: { sm: 'h-9 px-4 text-[13px]', md: 'h-11 px-5 text-sm', lg: 'h-[52px] px-6 text-[15px]' },
  variant: {
    primary: 'btn-shine bg-primary text-primary-fg hover:bg-primary-hover shadow-[0_0_24px_var(--glow)]',
    secondary: 'glass text-text hover:bg-glass-2',
    ghost: 'text-muted hover:text-text hover:bg-glass',
    danger: 'bg-danger text-white hover:opacity-90',
    outlineDanger: 'glass text-danger hover:bg-danger-soft',
  },
};

/** `arrow` adds a trailing → for forward actions. */
export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', loading, block, arrow, className, children, to, ...props },
  ref
) {
  const classes = cx(BUTTON.base, BUTTON.size[size], BUTTON.variant[variant], block && 'w-full', className);
  const content = (
    <>
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
      {arrow && !loading && <ArrowRight className="size-4" aria-hidden />}
    </>
  );
  if (to) {
    return (
      <Link ref={ref} to={to} className={classes} {...props}>
        {content}
      </Link>
    );
  }
  return (
    <button ref={ref} className={classes} disabled={loading || props.disabled} {...props}>
      {content}
    </button>
  );
});

/** Round glass icon button with a label underneath (Invite / Edit / Chat style). */
export function IconAction({ icon: Icon, label, to, onClick, disabled, tone }) {
  const inner = (
    <>
      <span
        className={cx(
          'glass grid size-14 place-items-center rounded-full transition-colors group-hover:bg-glass-2',
          tone === 'primary' && '!bg-primary !text-primary-fg'
        )}
      >
        <Icon className={cx('size-[22px]', tone !== 'primary' && 'text-primary-text')} strokeWidth={1.75} aria-hidden />
      </span>
      <span className="text-xs font-medium text-muted group-hover:text-text">{label}</span>
    </>
  );
  const cls = cx('group flex w-[4.75rem] flex-col items-center gap-2 text-center', disabled && 'pointer-events-none opacity-40');
  return to ? (
    <Link to={to} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} disabled={disabled} className={cls}>
      {inner}
    </button>
  );
}

export function IconActions({ children, className }) {
  return <div className={cx('flex justify-between gap-2 sm:justify-start sm:gap-6', className)}>{children}</div>;
}

/* ---------------- Surfaces ---------------- */

export function Card({ className, children, as: Tag = 'div', ...props }) {
  return (
    <Tag className={cx('glass rounded-3xl', className)} {...props}>
      {children}
    </Tag>
  );
}

/**
 * Grouped settings-style list (glass card, rows divided by hairlines).
 * Use <ListRow> inside.
 */
export function ListGroup({ title, children, className }) {
  return (
    <section className={className}>
      {title && <h2 className="mb-2.5 px-1 text-[15px] font-semibold">{title}</h2>}
      <div className="glass stagger divide-y divide-border overflow-hidden rounded-3xl">{children}</div>
    </section>
  );
}

/** Icon chip + title/subtitle + trailing value, with a chevron when it's a link. */
export function ListRow({ icon: Icon, title, subtitle, trailing, to, onClick, tone, chevron }) {
  const body = (
    <>
      {Icon && (
        <span
          className={cx(
            'grid size-9 shrink-0 place-items-center rounded-xl border border-glass-border bg-primary-soft',
            tone === 'danger' ? 'text-danger' : 'text-primary-text'
          )}
        >
          <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
        </span>
      )}
      <span className="min-w-0 flex-1 text-left">
        <span className={cx('block truncate text-sm font-medium', tone === 'danger' && 'text-danger')}>{title}</span>
        {subtitle && <span className="mt-0.5 block truncate text-[13px] text-muted">{subtitle}</span>}
      </span>
      {trailing != null && <span className="min-w-0 shrink truncate text-right text-sm text-muted">{trailing}</span>}
      {(to || onClick || chevron) && <ChevronRight className="size-4 shrink-0 text-faint" aria-hidden />}
    </>
  );
  const cls = 'flex w-full items-center gap-3.5 px-4 py-3.5 transition-colors';
  if (to) {
    return (
      <Link to={to} className={cx(cls, 'hover:bg-glass-2')}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cx(cls, 'hover:bg-glass-2')}>
        {body}
      </button>
    );
  }
  return <div className={cls}>{body}</div>;
}

/** iOS-style toggle. */
export function Switch({ checked, onChange, label, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-40',
        checked ? 'bg-primary' : 'bg-glass-3'
      )}
    >
      <span
        className={cx(
          'inline-block size-5 rounded-full shadow transition-transform',
          checked ? 'translate-x-6 bg-primary-fg' : 'translate-x-1 bg-faint'
        )}
      />
    </button>
  );
}

/* ---------------- Forms ---------------- */

const INPUT =
  'w-full rounded-2xl border border-glass-border bg-glass px-4 text-[15px] text-text placeholder:text-faint transition-colors hover:border-border-strong focus:border-text focus:bg-glass-2 focus:outline-none aria-[invalid=true]:border-danger';

export function Field({ label, hint, error, optional, children, className }) {
  const id = useId();
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cx('space-y-2', className)}>
      <label htmlFor={id} className="flex items-baseline justify-between px-1 text-[13px] font-medium text-muted">
        <span>{label}</span>
        {optional && <span className="text-xs font-normal text-faint">Optional</span>}
      </label>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {error ? (
        <p id={`${id}-err`} className="px-1 text-[13px] text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="px-1 text-[13px] text-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cx(INPUT, 'h-12', className)} {...props} />;
});

export const Textarea = forwardRef(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cx(INPUT, 'min-h-28 py-3', className)} {...props} />;
});

export const Select = forwardRef(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cx(INPUT, 'h-12 pr-9 [&>option]:bg-bg', className)} {...props}>
      {children}
    </select>
  );
});

/* ---------------- Status & feedback ---------------- */

const DOT = {
  neutral: 'bg-faint',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  live: 'bg-accent text-accent live-dot',
};
const PILL = {
  neutral: 'text-muted',
  success: 'text-success bg-success-soft',
  warning: 'text-warning bg-warning-soft',
  danger: 'text-danger bg-danger-soft',
  live: 'text-accent bg-accent-soft',
};

/** Status pill: dot + text, tinted only for real status. */
export function Status({ tone = 'neutral', children, className }) {
  return (
    <span className={cx('inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-medium', tone === 'neutral' ? 'bg-glass-2 text-muted' : PILL[tone], className)}>
      <span className={cx('size-1.5 rounded-full', DOT[tone])} aria-hidden />
      {children}
    </span>
  );
}

export function Tag({ children, className }) {
  return <span className={cx('inline-flex h-6 items-center rounded-full bg-glass-3 px-2.5 text-xs text-muted', className)}>{children}</span>;
}

export function Notice({ tone = 'neutral', title, children, action, className }) {
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cx('glass rounded-3xl p-4 md:p-5', className)}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1">
          {title && (
            <p className="flex items-center gap-2 text-[15px] font-medium">
              {tone !== 'neutral' && <span className={cx('size-2 shrink-0 rounded-full', DOT[tone])} aria-hidden />}
              {title}
            </p>
          )}
          {children && <div className={cx('text-sm text-muted', title && 'mt-1', title && tone !== 'neutral' && 'pl-4')}>{children}</div>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}
export const Alert = Notice;

export function Spinner({ label = 'Loading' }) {
  return (
    <div className="flex items-center justify-center py-24 text-muted" role="status">
      <Loader2 className="size-5 animate-spin" aria-hidden />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function Skeleton({ className }) {
  return <div className={cx('shimmer rounded-3xl', className)} aria-hidden />;
}

export function EmptyState({ icon: Icon, title, children, action, className }) {
  return (
    <div className={cx('glass flex flex-col items-center rounded-3xl px-6 py-14 text-center', className)}>
      {Icon && (
        <span className="mb-5 grid size-14 place-items-center rounded-full border border-glass-border bg-primary-soft">
          <Icon className="size-6 text-primary-text" strokeWidth={1.5} aria-hidden />
        </span>
      )}
      <p className="font-medium">{title}</p>
      {children && <p className="mt-1.5 max-w-xs text-sm text-muted">{children}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/* ---------------- Page chrome ---------------- */

export function PageHeader({ title, subtitle, actions, eyebrow }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1.5 text-[13px] text-muted">{eyebrow}</p>}
        <h1 className="text-[26px] font-semibold leading-tight md:text-[32px]">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-xl text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** CreatorPerks mark: a "C" (creator) around a play button, with a sparkle (perks), in a rounded square. */
export function LogoMark({ className = 'size-7' }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="9" fill="var(--text)" />
      <path d="M20.5 9.6A8 8 0 1 0 21.66 21.66" fill="none" stroke="var(--bg)" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M13.6 12.6v6.8l5.5-3.4z" fill="var(--bg)" />
      <path d="M24.2 6.2C24.5 8 25 8.5 26.8 8.8C25 9.1 24.5 9.6 24.2 11.4C23.9 9.6 23.4 9.1 21.6 8.8C23.4 8.5 23.9 8 24.2 6.2Z" fill="var(--bg)" />
    </svg>
  );
}

export function Logo({ className }) {
  return (
    <span className={cx('inline-flex items-center gap-2 text-[15px] font-semibold tracking-tight', className)}>
      <LogoMark />
      <span>CreatorPerks</span>
    </span>
  );
}

/* ---------------- Numbers ---------------- */

/** Colour per kind of number, used the same way everywhere. */
export const TONE_TEXT = {
  money: 'text-c-money',
  hold: 'text-c-hold',
  clips: 'text-c-clips',
  views: 'text-c-views',
  reach: 'text-c-reach',
  engage: 'text-c-engage',
};

// Colour is used only for earnings, so money stands out and everything else stays calm.
const TONE_BY_LABEL = {
  withdrawable: 'money',
  'total earned': 'money',
  'paid out': 'money',
  earned: 'money',
};

/** Text colour class for a number, from its label (e.g. "On hold" → amber). */
export const toneClass = (label) => TONE_TEXT[TONE_BY_LABEL[String(label).toLowerCase()]] || '';

export function Stat({ label, value, hint, tone, className }) {
  tone = tone || TONE_BY_LABEL[String(label).toLowerCase()];
  return (
    <div className={cx('min-w-0', className)}>
      <p className={cx('truncate font-mono text-[22px] font-medium tabular-nums md:text-[26px]', TONE_TEXT[tone])}>
        <CountUp value={value} />
      </p>
      <p className="label mt-1">{label}</p>
      {hint && <p className="mt-1 text-xs text-faint">{hint}</p>}
    </div>
  );
}

/**
 * Glass strip of stats divided by hairlines.
 * Phones: 2 columns (with 3 stats, the first spans the full width). Desktop: one row.
 */
export function StatGrid({ children, className }) {
  const items = Children.toArray(children);
  const n = items.length;
  const firstWide = n % 2 === 1;
  return (
    <div className={cx('glass stagger grid grid-cols-2 overflow-hidden rounded-3xl', n === 3 ? 'md:grid-cols-3' : 'md:grid-cols-4', className)}>
      {items.map((child, i) => {
        // Position in the 2-column phone grid.
        const pos = firstWide ? i - 1 : i;
        const wide = firstWide && i === 0;
        const lastRowStart = firstWide ? n - 3 : n - 2;
        return (
          <div
            key={i}
            className={cx(
              'border-border p-4 md:p-5',
              wide && 'col-span-2 md:col-span-1',
              !wide && pos % 2 === 0 && 'border-r',
              (wide || pos < lastRowStart) && 'border-b',
              'md:border-b-0',
              i < n - 1 ? 'md:border-r' : 'md:border-r-0'
            )}
          >
            {child}
          </div>
        );
      })}
    </div>
  );
}
/** Kept so pages can wrap stats explicitly; StatGrid adds the cell padding. */
export function StatCell({ children }) {
  return children;
}

/* ---------------- Switchers ---------------- */

/** Pill switcher, like "Run | Host". */
export function Segmented({ options, value, onChange, label, className }) {
  return (
    <div role="tablist" aria-label={label} className={cx('glass inline-flex rounded-full p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'h-9 flex-1 whitespace-nowrap rounded-full px-4 text-[13px] font-medium transition-colors',
            value === o.value ? 'bg-glass-3 text-text shadow-[inset_0_1px_0_var(--glass-hi)]' : 'text-muted hover:text-text'
          )}
        >
          {o.label}
          {o.count != null && <span className="ml-1.5 font-mono text-xs text-faint">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Horizontally scrolling filter chips. */
export function Chips({ options, value, onChange, label }) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0" role="group" aria-label={label}>
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value;
        const text = typeof o === 'string' ? o : o.label;
        const active = value === v;
        return (
          <button
            key={v}
            onClick={() => onChange(v)}
            aria-pressed={active}
            className={cx(
              'h-9 shrink-0 rounded-full px-4 text-[13px] font-medium transition-colors',
              active ? 'bg-primary text-primary-fg' : 'glass text-muted hover:text-text'
            )}
          >
            {text}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Profile picture: the Google photo when there is one, otherwise a generated
 * CreatorPerks-style pattern icon unique to the person.
 */
export function Avatar({ name = '', src, className }) {
  if (src) {
    return <img src={src} alt="" referrerPolicy="no-referrer" className={cx('size-9 shrink-0 rounded-[30%] border border-border-strong object-cover', className)} />;
  }
  return <IdentityIcon seed={name} className={cx('size-9 shrink-0', className)} />;
}

/** Key/value row (kept for simple detail lists). */
export function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 truncate text-right font-medium">{children ?? <span className="text-faint">—</span>}</dd>
    </div>
  );
}
