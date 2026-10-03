import { z } from "zod";
import { staffRoute, json, zEmail, zName, zId } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { can } from "@/lib/auth/permissions";
import { hideRevenueFromFrontDesk } from "@/lib/auth/session";
import { logAction } from "@/lib/audit";
import { archiveMember, assertPlan, assertReferrer, MEMBER_STATUSES } from "@/lib/members/service";

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
      keycardIssued: true,
      lastCheckIn: true,
      retentionScore: true,
      notes: true,
      archivedAt: true,
      createdAt: true,
      checkIns: { orderBy: { timestamp: "desc" }, take: 20, select: { id: true, location: true, timestamp: true } },
      payments: showPayments
        ? { orderBy: { createdAt: "desc" }, take: 20, select: { id: true, amount: true, gstCents: true, currency: true, status: true, createdAt: true } }
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
  return json({ ...member, payments: showPayments ? member.payments : null });
});

const UpdateBody = z
  .object({
    name: zName.optional(),
    email: zEmail.optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    referredById: zId.nullable().optional(),
    planId: zId.nullable().optional(),
    status: z.enum(MEMBER_STATUSES).optional(),
  })
  .refine((b) => Object.keys(b).length > 0, "Nothing to update");

// Contact details and notes: front desk. Plan and status: billing permission,
// because they change what the member pays or can access.
export const PUT = staffRoute({ permission: "members:write", body: UpdateBody }, async ({ params, body, db, staff }) => {
  const existing = await db.member.findUnique({ where: { id: params.id }, select: { id: true, status: true, planId: true, archivedAt: true } });
  if (!existing) throw new ApiError("not_found", "Member not found.");
  if (existing.archivedAt) throw new ApiError("conflict", "This member is archived and can't be edited.");

  const changesBilling =
    (body.status !== undefined && body.status !== existing.status) || (body.planId !== undefined && body.planId !== existing.planId);
  if (changesBilling && !can(staff.role, "billing:manage")) {
    throw new ApiError("forbidden", "Changing a member's plan or status needs a manager.");
  }
  await assertReferrer(db, body.referredById, params.id);
  await assertPlan(db, body.planId);
  if (body.email) {
    const clash = await db.member.findUnique({ where: { email: body.email }, select: { id: true } });
    if (clash && clash.id !== params.id) throw new ApiError("conflict", "Another member already uses that email.", { email: "Already in use" });
  }

  const member = await db.member.update({
    where: { id: params.id },
    data: body,
    select: { id: true, name: true, email: true, status: true, planId: true, notes: true, referredById: true },
  });
  await logAction(db, staff, {
    action: changesBilling ? "member.billing_changed" : "member.updated",
    targetType: "Member",
    targetId: member.id,
    details: { changed: Object.keys(body), from: { status: existing.status, planId: existing.planId }, to: { status: member.status, planId: member.planId } },
  });
  return json(member);
});

export const DELETE = staffRoute({ permission: "members:archive" }, async ({ params, db, staff }) => {
  await archiveMember(db, staff, params.id);
  return json({ ok: true });
});
