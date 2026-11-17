import { Logo } from '../../ui';

/** Shared frame for the short onboarding forms: progress + title, mobile-first. */
export default function OnboardingFrame({ step, total, title, subtitle, children }) {
  return (
    <div className="mx-auto min-h-dvh max-w-lg px-4 pb-10 pt-8">
      <div className="flex items-center justify-between">
        <Logo />
        <span className="font-mono text-xs text-muted">
          {step}/{total}
        </span>
      </div>
      <div className="mt-6 flex gap-1.5" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={`h-1 flex-1 rounded-full ${i < step ? 'bg-text' : 'bg-glass-3'}`} />
        ))}
      </div>
      <div className="mb-8 mt-10">
        <h1 className="text-[28px] font-semibold leading-tight">{title}</h1>
        {subtitle && <p className="mt-2 text-muted">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
