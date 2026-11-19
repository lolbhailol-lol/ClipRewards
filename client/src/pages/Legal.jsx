import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

const UPDATED = '18 November 2026';
const NAME = import.meta.env.VITE_LEGAL_NAME || 'CreatorPerks';
const EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || '';

function Contact() {
  return EMAIL ? (
    <a href={`mailto:${EMAIL}`} className="underline underline-offset-4">
      {EMAIL}
    </a>
  ) : (
    <Link to="/#pilot" className="underline underline-offset-4">
      the contact form on our homepage
    </Link>
  );
}

function Doc({ title, children }) {
  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-10 md:px-6 md:pt-16">
      <p className="label">Last updated {UPDATED}</p>
      <h1 className="mt-3 text-[32px] font-semibold leading-tight md:text-5xl">{title}</h1>
      <div className="legal mt-10 space-y-8 text-[15px] leading-relaxed text-muted [&_h2]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-text [&_li]:mt-1.5 [&_strong]:text-text [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
    </main>
  );
}

export function Privacy() {
  return (
    <Doc title="Privacy Policy">
      <section>
        <p>
          {NAME} (“we”, “us”) runs a platform where brands launch campaigns and creators earn money for verified views on short videos they post on their own
          Instagram and YouTube accounts. This policy explains what we collect, why, and the choices you have.
        </p>
      </section>

      <section>
        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Account details:</strong> when you sign in with Google we receive your name, email address and profile photo. We don’t receive your Google
            password.
          </li>
          <li>
            <strong>Role and profile:</strong> whether you’re a creator or a brand, and for brands the company name, contact person, phone, website and GSTIN you
            give us.
          </li>
          <li>
            <strong>Payout details:</strong> your UPI ID, which you add when you first withdraw.
          </li>
          <li>
            <strong>Instagram (if you connect it):</strong> your Instagram user ID, username, name, profile photo, account type, follower and post counts, a list of
            your recent posts (links, captions, thumbnails, dates), and insights for your account and posts such as views, reach, likes, comments, shares and
            saves. We store an access token, encrypted, so we can refresh these numbers.
          </li>
          <li>
            <strong>YouTube (if you connect it):</strong> your channel ID, title, handle, thumbnail, subscriber and video counts, and public statistics (views,
            likes, comments, length) of your videos. We use Google’s permission to view your YouTube account once, to confirm which channel is yours. We do{' '}
            <strong>not</strong> store that Google access token.
          </li>
          <li>
            <strong>Clips you submit:</strong> the post link, its title and thumbnail, and its view and engagement numbers over time.
          </li>
          <li>
            <strong>Earnings and payouts:</strong> what you earned per clip, withdrawals, and payment references.
          </li>
          <li>
            <strong>Technical data:</strong> standard server logs (IP address, browser, pages requested) used for security and fixing problems. Your sign-in session
            is stored in your browser.
          </li>
        </ul>
      </section>

      <section>
        <h2>How we use it</h2>
        <ul>
          <li>To create and run your account and show you relevant campaigns.</li>
          <li>To confirm that a clip you submit is on an account you own.</li>
          <li>To measure views, calculate what you’ve earned, detect fake or bot views, and pay you.</li>
          <li>To show you your own insights dashboards, and to show brands how their campaign performed (views, spend and the approved clips).</li>
          <li>To keep the service secure and to meet legal, tax and accounting obligations.</li>
        </ul>
        <p className="mt-3">
          We only <strong>read</strong> data from Instagram and YouTube. We never post, comment, message or change anything on your accounts. We don’t sell your
          personal data, and we don’t use it for advertising.
        </p>
      </section>

      <section>
        <h2>Who we share it with</h2>
        <ul>
          <li>
            <strong>Brands:</strong> for campaigns you join, the brand can see your public username, the clips you submit and their performance.
          </li>
          <li>
            <strong>Service providers</strong> who help us run the platform: Google Firebase (sign-in), MongoDB Atlas (database), Cloudinary (campaign images), our
            hosting provider, and payment providers when we pay you. They process data only on our instructions.
          </li>
          <li>
            <strong>Authorities</strong> when the law requires it.
          </li>
        </ul>
      </section>

      <section>
        <h2>Instagram and YouTube</h2>
        <p>
          Our use of Instagram data follows Meta’s Platform Terms. Our use of YouTube data relies on YouTube API Services. By connecting YouTube you also agree to the{' '}
          <a className="underline underline-offset-4" href="https://www.youtube.com/t/terms" target="_blank" rel="noreferrer">
            YouTube Terms of Service
          </a>
          , and Google’s handling of your data is covered by the{' '}
          <a className="underline underline-offset-4" href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">
            Google Privacy Policy
          </a>
          . You can also remove our access from your Google account at{' '}
          <a className="underline underline-offset-4" href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">
            myaccount.google.com/permissions
          </a>{' '}
          and from Instagram under Settings → Apps and websites.
        </p>
      </section>

      <section>
        <h2>How long we keep it</h2>
        <p>
          We keep account data while your account is open. Cached insights are refreshed and older copies are deleted within hours. When you disconnect Instagram or
          YouTube we delete the stored connection, token and cached insights straight away. Earnings and payout records are kept as long as Indian tax and
          accounting law requires.
        </p>
      </section>

      <section>
        <h2>Your choices and rights</h2>
        <ul>
          <li>Disconnect Instagram or YouTube any time from Profile → Connected accounts.</li>
          <li>Ask us for a copy of your data, to correct it, or to delete your account by contacting us at <Contact />.</li>
          <li>
            See{' '}
            <Link to="/data-deletion" className="underline underline-offset-4">
              how to delete your data
            </Link>{' '}
            for step-by-step instructions.
          </li>
          <li>You can withdraw consent at any time; this doesn’t affect anything done before.</li>
        </ul>
      </section>

      <section>
        <h2>Security</h2>
        <p>
          Data is sent over HTTPS. Instagram tokens are encrypted when stored. Access to our systems is limited to people who need it. No system is perfectly secure,
          and we’ll tell you if a breach affects you as the law requires.
        </p>
      </section>

      <section>
        <h2>Children</h2>
        <p>{NAME} is for people aged 18 and over. We don’t knowingly collect data from anyone younger.</p>
      </section>

      <section>
        <h2>Changes and contact</h2>
        <p>
          We’ll update this page if anything changes and show the new date at the top. Questions, requests or complaints (including to our grievance officer under
          India’s IT Rules): <Contact />.
        </p>
      </section>
    </Doc>
  );
}

export function Terms() {
  return (
    <Doc title="Terms of Service">
      <section>
        <p>
          These terms are an agreement between you and {NAME}. By using the platform you accept them. If you don’t agree, please don’t use {NAME}.
        </p>
      </section>

      <section>
        <h2>Who can use {NAME}</h2>
        <p>You must be 18 or older and able to enter a binding contract in India. You’re responsible for activity on your account.</p>
      </section>

      <section>
        <h2>For creators</h2>
        <ul>
          <li>You may only connect and submit content from accounts you own.</li>
          <li>Clips must follow the campaign brief and rules, include required disclosures such as #ad (as required by ASCI guidelines), and stay public.</li>
          <li>Only real, organic views count. Buying views, using bots, view-for-view groups or misleading edits is not allowed.</li>
          <li>
            Each clip is reviewed. Earnings are calculated from verified views at the campaign’s rate, up to any per-clip maximum and while the campaign budget lasts.
          </li>
          <li>
            Earnings are held for 7 days before they can be withdrawn, so we can check for fraud. We can withhold or reverse earnings for clips that break these
            terms or the campaign rules, are deleted, or show signs of fake views.
          </li>
          <li>Withdrawals go to the UPI ID you provide (minimum ₹200). You’re responsible for any taxes on what you earn; we may deduct tax where the law requires.</li>
          <li>You keep ownership of your content, and you allow the campaign’s brand and us to show and link to your submitted clips to report on the campaign.</li>
        </ul>
      </section>

      <section>
        <h2>For brands</h2>
        <ul>
          <li>We verify brands before their campaigns go live. Information you give us must be accurate.</li>
          <li>You must own or have rights to any footage, music, logos or other material you share with creators, and your brief must be lawful.</li>
          <li>You pay the campaign budget and our platform fee. Budget is spent only on approved clips with verified views.</li>
          <li>You approve clips against your brief. Approval can’t be withheld unreasonably for clips that follow it.</li>
        </ul>
      </section>

      <section>
        <h2>Things nobody may do</h2>
        <ul>
          <li>Break the law, Instagram’s or YouTube’s terms, or anyone’s intellectual property rights.</li>
          <li>Post hateful, harassing, sexual, violent or misleading content.</li>
          <li>Try to manipulate views or earnings, access other accounts, or disrupt the platform.</li>
        </ul>
        <p className="mt-3">We can suspend or close accounts that break these terms.</p>
      </section>

      <section>
        <h2>Third-party services</h2>
        <p>
          {NAME} relies on Instagram, YouTube and Google. Their terms also apply when you use them, and changes to their services can affect ours. By connecting
          YouTube you agree to the{' '}
          <a className="underline underline-offset-4" href="https://www.youtube.com/t/terms" target="_blank" rel="noreferrer">
            YouTube Terms of Service
          </a>
          .
        </p>
      </section>

      <section>
        <h2>Liability</h2>
        <p>
          The platform is provided “as is”. View counts come from Instagram and YouTube and can be delayed or corrected by them. To the extent the law allows, we
          aren’t liable for indirect losses, and our total liability to you is limited to the amount we paid you, or you paid us, in the 3 months before the claim.
        </p>
      </section>

      <section>
        <h2>Changes, law and contact</h2>
        <p>
          We may update these terms and will show the new date at the top. These terms are governed by the laws of India, and courts in Pune, Maharashtra have
          jurisdiction. Contact: <Contact />. Also see our{' '}
          <Link to="/privacy" className="underline underline-offset-4">
            Privacy Policy
          </Link>
          .
        </p>
      </section>
    </Doc>
  );
}

const A = ({ href, children }) => (
  <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-4">
    {children}
  </a>
);

/** Shows the status of a deletion Meta sent us (/data-deletion?code=…). */
function DeletionStatus({ code }) {
  const { data, error, isPending } = useQuery({ queryKey: ['deletion', code], queryFn: () => api(`/data-deletion/${encodeURIComponent(code)}`), retry: false });
  return (
    <section className="glass rounded-3xl p-5">
      <h2>Your request</h2>
      <p>
        Confirmation code: <span className="font-mono text-text">{code}</span>
      </p>
      <p className="mt-1">
        {isPending
          ? 'Checking…'
          : error
            ? error.message
            : `Done. Your Instagram connection, access token and stored Instagram data were deleted on ${new Date(data.requestedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}.`}
      </p>
    </section>
  );
}

export function DataDeletion() {
  const [params] = useSearchParams();
  const code = params.get('code');
  return (
    <Doc title="Delete your data">
      {code && <DeletionStatus code={code} />}
      <section>
        <p>
          You can remove your data from {NAME} at any time. Here is what each option deletes and how long it takes. See our{' '}
          <Link to="/privacy" className="underline underline-offset-4">
            Privacy Policy
          </Link>{' '}
          for what we collect.
        </p>
      </section>

      <section>
        <h2>Disconnect Instagram or YouTube (instant)</h2>
        <ul>
          <li>Sign in, open <strong>Profile → Connected accounts</strong> and tap <strong>Disconnect</strong>.</li>
          <li>We immediately delete the stored connection, the Instagram access token and all cached insights for that account.</li>
        </ul>
      </section>

      <section>
        <h2>Remove us from Instagram (instant)</h2>
        <ul>
          <li>
            On Instagram go to <strong>Settings → Apps and websites</strong> (
            <A href="https://www.instagram.com/accounts/manage_access/">open it here</A>), find {NAME} and tap <strong>Remove</strong>.
          </li>
          <li>Instagram tells us automatically, and we delete your Instagram connection, token and stored Instagram data straight away.</li>
          <li>If you also ask Instagram to delete your data, you’ll get a confirmation code. You can check its status on this page.</li>
        </ul>
      </section>

      <section>
        <h2>Remove us from Google / YouTube</h2>
        <ul>
          <li>
            Go to <A href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</A>, choose {NAME} and remove access.
          </li>
          <li>We never store your Google access token, so nothing more is needed. Disconnect YouTube in Profile to delete your stored channel details too.</li>
        </ul>
      </section>

      <section>
        <h2>Delete your whole account (within 30 days)</h2>
        <ul>
          <li>
            Contact us at <Contact /> from the email address you sign in with, with the subject <strong>“Delete my account”</strong>.
          </li>
          <li>We delete your profile, connected accounts, clips and insights within 30 days and confirm by email.</li>
          <li>
            If you’ve earned or been paid money, we keep the earnings and payout records Indian tax and accounting law requires (usually 8 years), and
            nothing else. Withdraw any balance first, as it can’t be paid after deletion.
          </li>
        </ul>
      </section>
    </Doc>
  );
}
