import { staffRoute, json } from "@/lib/http/route";
import { withinGracePeriod } from "@/lib/billing/reminders";

export const GET = staffRoute({ permission: "revenue:view" }, async ({ db }) => {
  const members = await db.member.findMany({
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
  return json(
    members.map(({ lastFailedInvoiceId, reminders, ...m }) => ({
      ...m,
      canRetry: Boolean(lastFailedInvoiceId),
      lastReminder: reminders[0] ?? null,
      accessSuspended: !withinGracePeriod(m.pastDueSince),
    }))
  );
});
