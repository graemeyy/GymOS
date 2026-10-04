import { z } from "zod";
import { staffRoute, json, zEmail, zName, zId } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { can } from "@/lib/auth/permissions";
import { hideRevenueFromFrontDesk } from "@/lib/auth/session";
import { logAction } from "@/lib/audit";
import { archiveMember, assertPlan, assertReferrer, MEMBER_STATUSES } from "@/lib/members/service";
import { currentCycle } from "@/lib/membership/cycle";
import { markPaidAtDesk, setPlanAtDesk, startMembership } from "@/lib/membership/service";

export const GET = staffRoute({ permission: "members:read" }, async ({ params, db, staff }) => {
  const now = new Date();
  const showPayments = can(staff.role, "revenue:view", { hideRevenueFromFrontDesk: await hideRevenueFromFrontDesk(db) });
  const member = await db.member.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      planId: true,
      membershipPlan: { select: { id: true, name: true, priceCents: true, interval: true } },
      pendingPlan: { select: { id: true, name: true } },
      currentPeriodStart: true,
      currentPeriodEnd: true,
      pausedFrom: true,
      pausedUntil: true,
      cancelAt: true,
      cancelledAt: true,
      cancelReason: true,
      pastDueSince: true,
      amountOwingCents: true,
      lastFailedInvoiceId: true,
      stripeSubscriptionId: true,
      keycardIssued: true,
      lastCheckIn: true,
      retentionScore: true,
      notes: true,
      archivedAt: true,
      createdAt: true,
      checkIns: { orderBy: { timestamp: "desc" }, take: 20, select: { id: true, location: true, timestamp: true } },
      payments: showPayments
        ? {
            orderBy: { paidAt: "desc" },
            take: 20,
            select: { id: true, amount: true, gstCents: true, currency: true, status: true, paidAt: true, invoiceNumber: true, refundedCents: true, kind: true, description: true },
          }
        : false,
      classBookings: {
        where: { class: { startTime: { gte: now } } },
        orderBy: { class: { startTime: "asc" } },
        select: { id: true, class: { select: { id: true, name: true, startTime: true, instructor: true } } },
      },
      classWaitlist: {
        where: { class: { startTime: { gte: now } } },
        orderBy: { class: { startTime: "asc" } },
        select: { id: true, class: { select: { id: true, name: true, startTime: true } } },
      },
      referredBy: { select: { id: true, name: true, email: true } },
      referrals: { select: { id: true, name: true, email: true, createdAt: true } },
    },
  });
  if (!member) throw new ApiError("not_found", "Member not found.");
  const { stripeSubscriptionId, lastFailedInvoiceId, ...rest } = member;
  const nextBillingDate =
    member.status === "CANCELED" || member.archivedAt
      ? null
      : member.membershipPlan
        ? currentCycle({ createdAt: member.createdAt, currentPeriodStart: member.currentPeriodStart, currentPeriodEnd: member.currentPeriodEnd }, member.membershipPlan.interval, now).end
        : null;
  return json({
    ...rest,
    nextBillingDate,
    hasSubscription: Boolean(stripeSubscriptionId),
    canRetryPayment: Boolean(lastFailedInvoiceId),
    payments: showPayments ? member.payments : null,
  });
});

const UpdateBody = z
  .object({
    name: zName.optional(),
    email: zEmail.optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    referredById: zId.nullable().optional(),
    keycardIssued: z.boolean().optional(),
    planId: zId.nullable().optional(),
    status: z.enum(MEMBER_STATUSES).optional(),
  })
  .refine((b) => Object.keys(b).length > 0, "Nothing to update");

// Contact details, notes and keycards: front desk. Plan and status: billing
// permission, because they change what the member pays or can access. Status
// and plan go through the membership service so history, dates and Stripe
// stay consistent (R-06); pausing and cancelling have their own actions.
export const PUT = staffRoute({ permission: "members:write", body: UpdateBody }, async ({ params, body, db, staff }) => {
  const existing = await db.member.findUnique({ where: { id: params.id }, select: { id: true, status: true, planId: true, archivedAt: true } });
  if (!existing) throw new ApiError("not_found", "Member not found.");
  if (existing.archivedAt) throw new ApiError("conflict", "This member is archived and can't be edited.");

  const { status, planId, ...details } = body;
  const statusChange = status !== undefined && status !== existing.status ? status : undefined;
  const planChange = planId !== undefined && planId !== existing.planId;
  if ((statusChange || planChange) && !can(staff.role, "billing:manage")) {
    throw new ApiError("forbidden", "Changing a member's plan or status needs a manager.");
  }
  if (statusChange && statusChange !== "ACTIVE") {
    throw new ApiError("validation_failed", "Use Pause or Cancel on the membership panel to change this.", { status: "Use the membership actions" });
  }
  await assertReferrer(db, details.referredById, params.id);
  await assertPlan(db, planId);
  if (details.email) {
    const clash = await db.member.findUnique({ where: { email: details.email }, select: { id: true } });
    if (clash && clash.id !== params.id) throw new ApiError("conflict", "Another member already uses that email.", { email: "Already in use" });
  }

  if (statusChange === "ACTIVE") {
    if (existing.status === "PAST_DUE") await markPaidAtDesk(db, staff, params.id);
    else await startMembership(db, staff, params.id, planId ?? existing.planId);
  } else if (planChange) {
    await setPlanAtDesk(db, staff, params.id, planId ?? null);
  }
  if (Object.keys(details).length > 0) {
    await db.$transaction(async (tx) => {
      await tx.member.update({ where: { id: params.id }, data: details });
      await logAction(tx, staff, { action: "member.updated", targetType: "Member", targetId: params.id, details: { changed: Object.keys(details) } });
    });
  }
  const member = await db.member.findUniqueOrThrow({
    where: { id: params.id },
    select: { id: true, name: true, email: true, status: true, planId: true, notes: true, referredById: true, keycardIssued: true },
  });
  return json(member);
});

export const DELETE = staffRoute({ permission: "members:archive" }, async ({ params, db, staff }) => {
  await archiveMember(db, staff, params.id);
  return json({ ok: true });
});
