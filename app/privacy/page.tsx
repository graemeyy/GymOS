import type { Metadata } from "next";
import { gym } from "@/lib/config";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Privacy policy" };

// Template privacy policy describing what GymOS actually collects and keeps.
// Retention periods come from config, so this page and the app agree.
export default function PrivacyPage() {
  const r = gym.policies.dataRetention;
  return (
    <LegalPage title="Privacy policy" version={gym.legal.privacyVersion}>
      <p>
        {gym.business.legalName} handles personal information under the Privacy Act 1988 and the Australian Privacy Principles. This policy says what we collect, why, who sees it, how long we keep it, and how to see, correct or delete it.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>Your name and email address.</li>
        <li>Your membership: plan, status, billing dates, pauses and cancellations, and your acceptance of these documents.</li>
        <li>Visits (check-in times), class bookings and waitlist places.</li>
        <li>Payments and shop orders, including a delivery address if you choose delivery.</li>
        <li>Notes staff make to help run your membership. Staff are asked not to record health details unless you ask them to.</li>
      </ul>
      <p>We don&apos;t ask for your date of birth, home address (unless you choose delivery), gender or photo. Card numbers go straight to Stripe; we never see or store them.</p>

      <h2>Why</h2>
      <p>To run your membership, let you in, book classes, take payments, send receipts and service messages, keep the financial records the law requires, and keep the gym safe. We only send gym news if you leave that switched on in your account.</p>

      <h2>Who else handles it</h2>
      <ul>
        <li>Stripe, to process card payments and manage subscriptions.</li>
        <li>Resend, to send emails from the gym.</li>
        <li>Our hosting and database providers, which store the app&apos;s data. [Owner to list providers and the countries where data is stored.]</li>
      </ul>
      <p>We don&apos;t sell your information or share it for advertising.</p>

      <h2>How long we keep it</h2>
      <ul>
        <li>Payment and tax records: {r.financialRecordsYears} years, as tax law requires (at least five years).</li>
        <li>Check-in history: {r.checkInHistoryMonths} months.</li>
        <li>After a membership ends and the account is archived: {r.archivedMemberMonths} months, then personal details are removed.</li>
      </ul>

      <h2>Seeing, correcting and deleting your information</h2>
      <p>
        In the member app you can download a copy of your information and delete your account. Deleting erases your name, email, bookings and staff notes. Payment records stay for the time tax law requires, without your details attached. To correct anything, ask at the front desk or email {gym.business.email}.
      </p>

      <h2>Security</h2>
      <p>Passwords are stored as one-way hashes, staff access is limited by role, and changes are logged. If a data breach is likely to cause you serious harm, we&apos;ll tell you and the Office of the Australian Information Commissioner as the law requires.</p>

      <h2>Questions and complaints</h2>
      <p>
        Email {gym.business.email}. If you&apos;re not satisfied with our answer, you can complain to the Office of the Australian Information Commissioner at oaic.gov.au.
      </p>
    </LegalPage>
  );
}
