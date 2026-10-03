import type { Prisma, Status } from "@prisma/client";
import type { Db } from "@/lib/db";
import { ApiError } from "@/lib/http/errors";
import { getStripe } from "@/lib/billing/stripe";
import { logAction, type Actor } from "@/lib/audit";

export const MEMBER_STATUSES = ["ACTIVE", "PAUSED", "PAST_DUE", "CANCELED"] as const satisfies readonly Status[];

export const STATUS_LABELS: Record<Status, string> = {
  ACTIVE: "Active",
  PAUSED: "Paused",
  PAST_DUE: "Past due",
  CANCELED: "Cancelled",
};

// Fields staff lists may show. Never includes passwordHash or sessionVersion.
export const memberListSelect = {
  id: true,
  name: true,
  email: true,
  status: true,
  planId: true,
  membershipPlan: { select: { id: true, name: true, slug: true } },
  lastCheckIn: true,
  retentionScore: true,
  referredById: true,
  archivedAt: true,
  createdAt: true,
} satisfies Prisma.MemberSelect;

export async function assertReferrer(db: Db, referredById: string | null | undefined, selfId?: string) {
  if (!referredById) return;
  if (referredById === selfId) throw new ApiError("validation_failed", "A member can't refer themselves.", { referredById: "Choose someone else" });
  const referrer = await db.member.findUnique({ where: { id: referredById }, select: { id: true } });
  if (!referrer) throw new ApiError("validation_failed", "Referring member not found.", { referredById: "Not found" });
}

export async function assertPlan(db: Db, planId: string | null | undefined) {
  if (!planId) return;
  const plan = await db.membershipPlan.findUnique({ where: { id: planId }, select: { id: true } });
  if (!plan) throw new ApiError("validation_failed", "That plan doesn't exist.", { planId: "Not found" });
}

// Archiving replaces hard delete. Payments, check-ins and bookings stay (tax
// records and attendance history); the member can no longer sign in, future
// bookings and waitlist places are released, and any Stripe subscription is
// cancelled. Personal-data erasure on request is a separate, later step.
export async function archiveMember(db: Db, actor: Actor, memberId: string) {
  const member = await db.member.findUnique({
    where: { id: memberId },
    select: { id: true, name: true, email: true, archivedAt: true, stripeSubscriptionId: true },
  });
  if (!member) throw new ApiError("not_found", "Member not found.");
  if (member.archivedAt) return member;

  if (member.stripeSubscriptionId) {
    try {
      await getStripe().subscriptions.cancel(member.stripeSubscriptionId);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("upstream_failed", "Stripe couldn't cancel the subscription, so the member wasn't archived. Try again shortly.");
    }
  }

  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.classBooking.deleteMany({ where: { memberId, status: "BOOKED", class: { startTime: { gt: now } } } });
    await tx.classWaitlist.deleteMany({ where: { memberId, class: { startTime: { gt: now } } } });
    await tx.member.update({
      where: { id: memberId },
      data: { archivedAt: now, status: "CANCELED", sessionVersion: { increment: 1 } },
    });
    await logAction(tx, actor, {
      action: "member.archived",
      targetType: "Member",
      targetId: memberId,
      details: { name: member.name, email: member.email, hadSubscription: Boolean(member.stripeSubscriptionId) },
    });
  });
  return member;
}
