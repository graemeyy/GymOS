import type { Metadata } from "next";
import { gym, formatAddress } from "@/lib/config";
import { formatAud } from "@/lib/money";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Membership terms" };

// Template membership terms built from the owner's settings. Written to
// respect the Australian Consumer Law: nothing here limits consumer
// guarantees, and every rule comes from config so the page and the app agree.
export default function TermsPage() {
  const c = gym.policies.cancellation;
  const p = gym.policies.pause;
  const classes = gym.policies.classes;
  const failed = gym.policies.failedPayments;
  const shop = gym.policies.shop;
  return (
    <LegalPage title="Membership terms" version={gym.legal.termsVersion}>
      <p>
        These terms are between you and {gym.business.legalName} (ABN {gym.business.abn}), {formatAddress()} (&quot;we&quot;). They apply when you join online or at the front desk.
      </p>

      <h2>Your rights under Australian Consumer Law</h2>
      <p>
        Our services come with guarantees that can&apos;t be excluded under the Australian Consumer Law. If a service isn&apos;t provided with due care and skill, or isn&apos;t fit for its purpose, you&apos;re entitled to a remedy. Nothing in these terms
        limits those rights.
      </p>

      <h2>Prices and payment</h2>
      <ul>
        <li>All prices are in Australian dollars and include GST{gym.business.gstRegistered ? "" : " where it applies"}.</li>
        <li>Memberships are charged in advance at the start of each billing period (weekly, fortnightly, monthly or yearly, depending on your plan) by card through Stripe, or at the front desk.</li>
        <li>If we change the price of your plan, we&apos;ll give you written notice before the new price applies to you, and you can cancel under these terms.</li>
        <li>
          If a payment fails, we&apos;ll email you{failed.reminderDays.length ? ` (after ${failed.reminderDays.join(", ")} days)` : ""}. Your access continues for {failed.suspendAccessAfterDays} days while you update your card, then pauses until the amount owing is paid.
        </li>
      </ul>

      <h2>Cooling-off</h2>
      <p>
        {c.coolingOffDays > 0
          ? `You can cancel within ${c.coolingOffDays} days of joining and the cancellation takes effect straight away. Some states give you additional rights for fitness memberships; those apply as well.`
          : "Some states give you a cooling-off right for fitness memberships; where it applies, you can use it."}
      </p>

      <h2>Cancelling</h2>
      <ul>
        <li>
          You can cancel {c.allowMemberSelfCancel ? "in the member app, " : ""}at the front desk or by emailing {gym.business.email}.
        </li>
        <li>After the cooling-off period, cancellation takes effect {c.noticeDays} days after you ask{c.minimumTermWeeks > 0 ? `, or at the end of your ${c.minimumTermWeeks}-week minimum term if that's later` : ""}. You can keep training until then.</li>
        <li>We may end a membership straight away for serious or repeated breaches of the gym rules, and will refund any amount paid for the period after that.</li>
        <li>If you can&apos;t use the gym because of illness, injury or moving away, talk to us. We can end your membership early.</li>
      </ul>

      <h2>Pausing</h2>
      <p>
        {p.allowMemberSelfPause ? "You can pause in the member app or at the front desk" : "Ask at the front desk to pause"} for between {p.minDays} and {p.maxDays} days, up to {p.maxPausesPerYear} times in 12 months.
        {p.feeCents > 0 ? ` A pause costs ${formatAud(p.feeCents)}.` : " There's no charge for pausing."} You aren&apos;t charged while paused.
      </p>

      <h2>Changing plans</h2>
      <p>
        Upgrades {gym.policies.planChanges.upgradeProration === "prorate_now" ? "start straight away, with a part-period charge for the difference" : "start at your next billing date"}. Downgrades{" "}
        {gym.policies.planChanges.downgradeTiming === "immediate" ? "start straight away" : "start at your next billing date"}.
      </p>

      <h2>Classes</h2>
      <p>
        Booking opens {classes.bookingOpensDaysAhead} days ahead. Please cancel at least {classes.cancelWithoutPenaltyHours} hours before a class
        {classes.lateCancelForfeitsCredit ? "; a later cancellation uses the class credit on plans with a class limit" : ""}. Unused class credits don&apos;t carry over to the next billing period.
      </p>

      <h2>Shop</h2>
      <p>
        {shop.changeOfMindReturnsDays > 0 ? `Unused items can be returned within ${shop.changeOfMindReturnsDays} days if you change your mind.` : "We don't offer refunds for change of mind."} Faulty items, or items not as described,
        are always covered by the Australian Consumer Law.
      </p>

      <h2>Your health and safety</h2>
      <p>Tell staff about any condition that could affect your safety when exercising, and follow staff directions and the gym rules. Ask a doctor before starting if you&apos;re unsure whether exercise is safe for you.</p>

      <h2>Your information</h2>
      <p>
        We handle your personal information under our <a href="/privacy" className="font-medium text-plate underline underline-offset-2">privacy policy</a>.
      </p>

      <h2>Contact and complaints</h2>
      <p>
        Email {gym.business.email} or call {gym.business.phone}. If we can&apos;t resolve a complaint, you can contact your state or territory&apos;s fair trading or consumer affairs agency.
      </p>
    </LegalPage>
  );
}
