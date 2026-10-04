import { staffRoute, json } from "@/lib/http/route";
import { listOverdueMembers, withinGracePeriod } from "@/lib/billing/reminders";

export const GET = staffRoute({ permission: "finance.view" }, async ({ db }) => {
  const members = await listOverdueMembers(db);
  return json(
    members.map(({ lastFailedInvoiceId, reminders, ...m }) => ({
      ...m,
      canRetry: Boolean(lastFailedInvoiceId),
      lastReminder: reminders[0] ?? null,
      accessSuspended: !withinGracePeriod(m.pastDueSince),
    }))
  );
});
