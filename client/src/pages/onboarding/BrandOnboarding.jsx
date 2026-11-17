import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { VERTICALS } from '../../lib/format';
import { Alert, Button, Field, Input, Select } from '../../ui';
import OnboardingFrame from './OnboardingFrame';

/** Also used to update details when the admin asks for more info. */
export default function BrandOnboarding() {
  const { brand, setMe } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    company: brand?.company || '',
    contactName: brand?.contactName || '',
    contactPhone: brand?.contactPhone || '',
    website: brand?.website || '',
    gstin: brand?.gstin || '',
    vertical: brand?.vertical || 'genz',
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const isUpdate = Boolean(brand);

  const save = useMutation({
    mutationFn: () => api('/onboarding/brand', { method: 'POST', body: form }),
    onSuccess: (data) => {
      setMe(data);
      navigate('/brand', { replace: true });
    },
  });

  return (
    <OnboardingFrame
      step={2}
      total={2}
      title={isUpdate ? 'Update your brand details' : 'Tell us about your brand'}
      subtitle="We check every brand before campaigns go live. This keeps creators safe and usually takes under a day."
    >
      {brand?.adminNote && brand.approvalStatus !== 'approved' && (
        <Alert tone="warning" title="Note from our team" className="mb-5">
          {brand.adminNote}
        </Alert>
      )}
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <Field label="Company or brand name">{(p) => <Input {...p} required autoComplete="organization" value={form.company} onChange={set('company')} />}</Field>
        <Field label="Website or Instagram" optional>
          {(p) => <Input {...p} type="text" inputMode="url" autoCapitalize="none" placeholder="brand.in or @brand" value={form.website} onChange={set('website')} />}
        </Field>
        <Field label="Category">
          {(p) => (
            <Select {...p} value={form.vertical} onChange={set('vertical')}>
              {VERTICALS.map((v) => (
                <option key={v.value} value={v.value}>{v.label}</option>
              ))}
            </Select>
          )}
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Contact person">{(p) => <Input {...p} required autoComplete="name" value={form.contactName} onChange={set('contactName')} />}</Field>
          <Field label="Phone" optional>{(p) => <Input {...p} type="tel" inputMode="tel" autoComplete="tel" placeholder="+91 98765 43210" value={form.contactPhone} onChange={set('contactPhone')} />}</Field>
        </div>
        <Field label="GSTIN" optional hint="Needed for GST invoices. You can add it later.">
          {(p) => <Input {...p} autoCapitalize="characters" maxLength={15} value={form.gstin} onChange={set('gstin')} />}
        </Field>
        {save.error && <Alert tone="danger">{save.error.message}</Alert>}
        <Button type="submit" size="lg" block arrow loading={save.isPending}>
          {isUpdate ? 'Send for review again' : 'Submit for review'}
        </Button>
      </form>
    </OnboardingFrame>
  );
}
