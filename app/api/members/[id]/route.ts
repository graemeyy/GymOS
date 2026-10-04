import { staffRoute, json } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { canSeeMemberMoney, forViewer } from "@/lib/members/privacy";
import { UpdateMemberBody } from "@/lib/members/schema";
import { getMemberDetail } from "@/lib/members/queries";
import { archiveMember, updateMember } from "@/lib/members/service";
import { currentCycle } from "@/lib/membership/cycle";

export const GET = staffRoute({ permission: "members.view" }, async ({ params, db, staff }) => {
  const now = new Date();
  // Payments and amounts owing need private details and finance.view (R-43).
  const showPayments = canSeeMemberMoney(staff);
  const member = await getMemberDetail(db, params.id, { showPayments, now });
  if (!member) throw new ApiError("not_found", "Member not found.");
  const { stripeSubscriptionId, lastFailedInvoiceId, ...rest } = member;
  const nextBillingDate =
    member.status === "CANCELED" || member.archivedAt
      ? null
      : member.membershipPlan
        ? currentCycle({ createdAt: member.createdAt, currentPeriodStart: member.currentPeriodStart, currentPeriodEnd: member.currentPeriodEnd }, member.membershipPlan.interval, now).end
        : null;
  return json(forViewer(staff, {
    ...rest,
    nextBillingDate,
    hasSubscription: Boolean(stripeSubscriptionId),
    canRetryPayment: Boolean(lastFailedInvoiceId),
    payments: showPayments ? member.payments : null,
    amountOwingCents: showPayments ? member.amountOwingCents : null,
  }));
});

export const PUT = staffRoute({ permission: "members.edit", body: UpdateMemberBody }, async ({ params, body, db, staff }) => json(await updateMember(db, staff, params.id, body)));

export const DELETE = staffRoute({ permission: "members.edit" }, async ({ params, db, staff }) => {
  await archiveMember(db, staff, params.id);
  return json({ ok: true });
});
