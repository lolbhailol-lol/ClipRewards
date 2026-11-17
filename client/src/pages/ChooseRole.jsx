import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Building2, Check, Clapperboard } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Alert, Button, Logo, cx } from '../ui';

const OPTIONS = [
  { value: 'creator', icon: Clapperboard, title: 'I’m a creator', text: 'Edit and post clips for brands. Earn per 1,000 views.' },
  { value: 'brand', icon: Building2, title: 'I’m a brand', text: 'Run campaigns. Pay only for real, approved views.' },
];

function intendedRole() {
  try {
    return sessionStorage.getItem('cr_intended_role');
  } catch {
    return null;
  }
}

export default function ChooseRole() {
  const [role, setRole] = useState(intendedRole() || '');
  const { setMe } = useAuth();
  const navigate = useNavigate();

  const save = useMutation({
    mutationFn: () => api('/onboarding/role', { method: 'POST', body: { role } }),
    onSuccess: ({ user }) => {
      setMe({ user });
      navigate(`/onboarding/${user.role}`, { replace: true });
    },
  });

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 pb-6 pt-8">
      <Logo />
      <div className="mt-12">
        <h1 className="text-[28px] font-semibold leading-tight">How will you use ClipRewards?</h1>
        <p className="mt-2 text-muted">Pick one. This can’t be changed later.</p>
      </div>

      <fieldset className="mt-8 space-y-3">
        <legend className="sr-only">Account type</legend>
        {OPTIONS.map(({ value, icon: Icon, title, text }) => {
          const active = role === value;
          return (
            <label
              key={value}
              className={cx(
                'glass flex cursor-pointer items-center gap-4 rounded-3xl p-4 transition-colors',
                active ? '!border-text' : 'hover:bg-glass-2'
              )}
            >
              <input type="radio" name="role" value={value} checked={active} onChange={() => setRole(value)} className="sr-only" />
              <span className={cx('grid size-12 shrink-0 place-items-center rounded-2xl', active ? 'bg-primary text-primary-fg' : 'bg-glass-3')}>
                <Icon className="size-[22px]" strokeWidth={1.75} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{title}</span>
                <span className="mt-0.5 block text-sm text-muted">{text}</span>
              </span>
              <span className={cx('grid size-6 shrink-0 place-items-center rounded-full border', active ? 'border-text bg-text text-bg' : 'border-border-strong')}>
                {active && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
              </span>
            </label>
          );
        })}
      </fieldset>

      {save.error && <Alert tone="danger" className="mt-4">{save.error.message}</Alert>}
      <div className="mt-auto pt-10">
        <Button size="lg" block arrow disabled={!role} loading={save.isPending} onClick={() => save.mutate()}>
          Continue
        </Button>
      </div>
    </div>
  );
}
