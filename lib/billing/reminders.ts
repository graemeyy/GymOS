import type { Db } from "@/lib/db";
import { gym } from "@/lib/config";
import { formatAud } from "@/lib/money";
import { env } from "@/lib/env";
import { sendEmail, signature } from "@/lib/email";
import { DAY_MS } from "@/lib/time";

// Sends each configured reminder once per overdue episode. Stripe's own
// Smart Retries keep retrying the card; these emails ask the member to update
// it. Reminders already sent are recorded, so reruns don't double-send.
export async function sendPaymentReminders(db: Db, now = new Date()) {
  const days = [...gym.policies.failedPayments.reminderDays].sort((a, b) => a - b);
  const members = await db.member.findMany({
    where: { archivedAt: null, status: "PAST_DUE", pastDueSince: { not: null } },
    select: { id: true, name: true, email: true, pastDueSince: true, amountOwingCents: true },
  });
  let sent = 0;
  for (const m of members) {
    const overdueDays = Math.floor((now.getTime() - m.pastDueSince!.getTime()) / DAY_MS);
    const due = days.filter((d) => d <= overdueDays);
    if (due.length === 0) continue;
    const day = due[due.length - 1];
    // Claim the reminder before sending it: the unique key means only one of
    // two overlapping runs gets the row, and only that one emails (R-72).
    const claimed = await db.paymentReminder.createMany({ data: [{ memberId: m.id, pastDueSince: m.pastDueSince!, day }], skipDuplicates: true });
    if (claimed.count === 0) continue;
    const suspendIn = gym.policies.failedPayments.suspendAccessAfterDays - overdueDays;
    const owing = m.amountOwingCents > 0 ? ` of ${formatAud(m.amountOwingCents)}` : "";
    await sendEmail({
      to: m.email,
      subject: `Your ${gym.brand.shortName} payment didn't go through`,
      text:
        `Hi ${m.name?.split(" ")[0] ?? "there"},\n\nYour last membership payment${owing} didn't go through. ` +
        `Update your card at ${env().NEXT_PUBLIC_APP_URL}/member and we'll retry it automatically.` +
        (suspendIn > 0 ? ` Gym access pauses in ${suspendIn} day(s) if it's still unpaid.` : " Gym access is paused until it's paid.") +
        signature(),
    });
    sent++;
  }
  return { remindersSent: sent };
}

// The front desk's overdue list, longest overdue first, with the last
// reminder each member was sent.
export function listOverdueMembers(db: Db) {
  return db.member.findMany({
    where: { archivedAt: null, status: "PAST_DUE" },
    orderBy: { pastDueSince: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      pastDueSince: true,
      amountOwingCents: true,
      lastFailedInvoiceId: true,
      membershipPlan: { select: { name: true } },
      reminders: { orderBy: { sentAt: "desc" }, take: 1, select: { day: true, sentAt: true } },
    },
  });
}

// True while a past-due member is still inside the grace period set by the
// owner, so the front desk can let them in and remind them.
export function withinGracePeriod(pastDueSince: Date | null, now = new Date()): boolean {
  if (!pastDueSince) return false;
  return now.getTime() - pastDueSince.getTime() < gym.policies.failedPayments.suspendAccessAfterDays * DAY_MS;
}
