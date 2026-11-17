import {
  BadgeCheck,
  Building2,
  CheckCircle2,
  Circle,
  CircleHelp,
  ClipboardCheck,
  CreditCard,
  Globe,
  LogOut,
  Mail,
  Megaphone,
  Moon,
  Pencil,
  Phone,
  Receipt,
  Tag as TagIcon,
  UserRound,
} from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { rupees, verticalLabel } from '../../lib/format';
import { THEME_OPTIONS, useTheme } from '../../lib/theme';
import {
  Button,
  EmptyState,
  IconAction,
  IconActions,
  ListGroup,
  ListRow,
  Notice,
  PageHeader,
  Segmented,
  Stat,
  StatGrid,
  Status,
} from '../../ui';

const STATUS = {
  pending: { tone: 'warning', label: 'Under review' },
  approved: { tone: 'success', label: 'Verified' },
  info_requested: { tone: 'warning', label: 'Info needed' },
  rejected: { tone: 'danger', label: 'Not approved' },
};

export function BrandStatus({ status }) {
  const s = STATUS[status] ?? STATUS.pending;
  return <Status tone={s.tone}>{s.label}</Status>;
}

function StatusNotice({ brand }) {
  switch (brand.approvalStatus) {
    case 'approved':
      return (
        <Notice tone="success" title="Your brand is verified">
          You can create campaigns now. We’ll help you set the right rate and budget for your first pilot.
        </Notice>
      );
    case 'info_requested':
      return (
        <Notice tone="warning" title="We need a bit more information" action={<Button to="/onboarding/brand" size="sm" variant="secondary">Update</Button>}>
          {brand.adminNote}
        </Notice>
      );
    case 'rejected':
      return (
        <Notice tone="danger" title="Your brand wasn’t approved" action={<Button to="/onboarding/brand" size="sm" variant="secondary">Update</Button>}>
          {brand.adminNote}
        </Notice>
      );
    default:
      return (
        <Notice tone="warning" title="We’re reviewing your brand">
          This usually takes less than a day. We’ll email you when it’s done.
        </Notice>
      );
  }
}

export function BrandOverview() {
  const { brand, user } = useAuth();
  if (!brand) return null;
  const approved = brand.approvalStatus === 'approved';
  const steps = [
    { done: true, title: 'Create your account' },
    { done: approved, title: 'Get your brand verified', subtitle: approved ? 'Done' : 'Usually under a day' },
    { done: false, title: 'Create your first campaign', subtitle: 'Brief, rate per 1K views, budget' },
    { done: false, title: 'Fund it and go live', subtitle: 'Creators start posting' },
  ];

  return (
    <>
      <PageHeader eyebrow={brand.company} title={`Hi, ${user?.name?.split(' ')[0] || 'there'}`} actions={<BrandStatus status={brand.approvalStatus} />} />
      <StatusNotice brand={brand} />

      <StatGrid className="mt-5">
        <Stat label="Views" value="0" />
        <Stat label="Spend" value={rupees(0)} />
        <Stat label="Cost / 1K" value="—" />
        <Stat label="Clips" value="0" />
      </StatGrid>

      <IconActions className="mt-6">
        <IconAction icon={Megaphone} label="Campaign" to="/brand/campaigns" />
        <IconAction icon={ClipboardCheck} label="Approve" to="/brand/approvals" />
        <IconAction icon={Receipt} label="Billing" to="/brand/account" />
        <IconAction icon={CircleHelp} label="Help" to="/#pilot" />
      </IconActions>

      <ListGroup title="Get started" className="mt-8">
        {steps.map((s) => (
          <ListRow key={s.title} icon={s.done ? CheckCircle2 : Circle} title={s.title} subtitle={s.subtitle} />
        ))}
      </ListGroup>
      <p className="mt-3 px-1 text-[13px] text-faint">The campaign builder opens soon. Until then, our team sets up pilots with you directly.</p>
    </>
  );
}

export function BrandCampaigns() {
  return (
    <>
      <PageHeader eyebrow="Brand" title="Campaigns" actions={<Button disabled size="sm">New campaign</Button>} />
      <EmptyState icon={Megaphone} title="No campaigns yet">
        Create a campaign with your brief, rate per 1,000 views and budget. Creators start posting once it’s live.
      </EmptyState>
    </>
  );
}

export function BrandApprovals() {
  return (
    <>
      <PageHeader eyebrow="Brand" title="Approvals" subtitle="Approve or reject each clip before any views are paid." />
      <EmptyState icon={ClipboardCheck} title="Nothing to review">
        Clips submitted to your campaigns show up here for one-tap approval.
      </EmptyState>
    </>
  );
}

export function BrandAccount() {
  const { brand, user, signOut } = useAuth();
  const [theme, setTheme] = useTheme();
  if (!brand) return null;

  return (
    <>
      <PageHeader eyebrow="Brand" title="Account" actions={<Button to="/onboarding/brand" variant="secondary" size="sm"><Pencil className="size-3.5" aria-hidden /> Edit</Button>} />

      <ListGroup title="Company">
        <ListRow icon={Building2} title={brand.company} subtitle={verticalLabel(brand.vertical)} trailing={<BrandStatus status={brand.approvalStatus} />} />
        <ListRow icon={Globe} title="Website" subtitle={brand.website || 'Not added'} />
        <ListRow icon={TagIcon} title="GSTIN" subtitle={brand.gstin || 'Not added'} />
      </ListGroup>

      <ListGroup title="Contact" className="mt-8">
        <ListRow icon={UserRound} title={brand.contactName} subtitle="Contact person" />
        <ListRow icon={Mail} title="Email" subtitle={user?.email} />
        <ListRow icon={Phone} title="Phone" subtitle={brand.contactPhone || 'Not added'} />
      </ListGroup>

      <ListGroup title="Billing" className="mt-8">
        <ListRow icon={CreditCard} title="Payment method" subtitle="Added when you fund your first campaign" />
        <ListRow icon={Receipt} title="Invoices" subtitle="GST invoices appear here" />
      </ListGroup>

      <ListGroup title="Preferences" className="mt-8">
        <div className="flex items-center gap-3.5 px-4 py-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-glass-3">
            <Moon className="size-[18px]" strokeWidth={1.75} aria-hidden />
          </span>
          <span className="flex-1 text-sm font-medium">Theme</span>
          <Segmented label="Theme" value={theme} onChange={setTheme} options={THEME_OPTIONS} />
        </div>
      </ListGroup>

      <ListGroup title="Support" className="mt-8">
        <ListRow icon={BadgeCheck} title="Why we verify brands" subtitle="It keeps creators safe and payouts real" />
        <ListRow icon={LogOut} title="Sign out" tone="danger" onClick={signOut} />
      </ListGroup>
    </>
  );
}
