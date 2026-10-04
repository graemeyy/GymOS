import type { Prisma } from "@prisma/client";
import type { Db } from "@/lib/db";
import { gym } from "@/lib/config";
import { ApiError } from "@/lib/http/errors";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { logAction, type Actor } from "@/lib/audit";
import { recordAcceptance } from "@/lib/legal";

export const ERASED = "[erased]";

// Online sign-up. The new member has no plan and no access until they start
// one (status PENDING). An email that already belongs to a member is refused
// rather than claimed: without email verification, letting anyone set a
// password on an existing record would hand over someone else's account.
export async function signUpMember(db: Db, input: { name: string; email: string; password: string }) {
  const existing = await db.member.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existing) {
    throw new ApiError("conflict", "That email already has a membership. Sign in, or ask the front desk to set up online access for you.", { email: "Already registered" });
  }
  const passwordHash = await hashPassword(input.password);
  return db.$transaction(async (tx) => {
    const member = await tx.member.create({
      data: { name: input.name, email: input.email, passwordHash, status: "PENDING", planId: null },
      select: { id: true, name: true, email: true, sessionVersion: true },
    });
    await recordAcceptance(tx, member.id, "signup");
    await logAction(tx, { kind: "member", id: member.id, name: input.name, email: input.email }, {
      action: "member.signed_up",
      targetType: "Member",
      targetId: member.id,
      details: { termsVersion: gym.legal.termsVersion, privacyVersion: gym.legal.privacyVersion },
    });
    return member;
  });
}

export async function changeMemberPassword(db: Db, memberId: string, current: string, next: string) {
  const member = await db.member.findUniqueOrThrow({ where: { id: memberId }, select: { passwordHash: true, name: true, email: true } });
  if (!member.passwordHash || !(await verifyPassword(current, member.passwordHash))) {
    throw new ApiError("validation_failed", "Your current password isn't right.", { current: "Doesn't match" });
  }
  // Bumping the session version signs out every other device; the caller
  // issues a fresh cookie for this one.
  const updated = await db.member.update({
    where: { id: memberId },
    data: { passwordHash: await hashPassword(next), sessionVersion: { increment: 1 } },
    select: { sessionVersion: true },
  });
  await logAction(db, { kind: "member", id: memberId, name: member.name ?? member.email, email: member.email }, { action: "member.password_changed", targetType: "Member", targetId: memberId });
  return updated.sessionVersion;
}

// Everything GymOS holds about the member (Privacy Act, APP 12), as plain
// data. Staff notes are included: they are personal information about the
// member. Internal fields (password hash, session version, retention score
// inputs) are not information about the person and are left out.
export async function exportMemberData(db: Db, memberId: string) {
  const member = await db.member.findUniqueOrThrow({
    where: { id: memberId },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      createdAt: true,
      onboardedAt: true,
      lastCheckIn: true,
      keycardIssued: true,
      currentPeriodStart: true,
      currentPeriodEnd: true,
      pausedFrom: true,
      pausedUntil: true,
      cancelAt: true,
      cancelledAt: true,
      cancelReason: true,
      notifyAnnouncements: true,
      notifyWaitlist: true,
      membershipPlan: { select: { name: true, priceCents: true, interval: true } },
      legalAcceptances: { select: { document: true, version: true, context: true, acceptedAt: true }, orderBy: { acceptedAt: "asc" } },
      payments: {
        select: { invoiceNumber: true, createdAt: true, amount: true, gstCents: true, refundedCents: true, currency: true, status: true, description: true, kind: true },
        orderBy: { createdAt: "asc" },
      },
      orders: {
        select: { number: true, createdAt: true, status: true, fulfilment: true, totalCents: true, gstCents: true, discountCents: true, shippingCents: true, shippingAddress: true, trackingNumber: true, items: { select: { productName: true, variantLabel: true, quantity: true, lineTotalCents: true } } },
        orderBy: { createdAt: "asc" },
      },
      classBookings: { select: { status: true, usedCredit: true, createdAt: true, class: { select: { name: true, startTime: true } } }, orderBy: { createdAt: "asc" } },
      classWaitlist: { select: { createdAt: true, class: { select: { name: true, startTime: true } } } },
      checkIns: { select: { timestamp: true, method: true }, orderBy: { timestamp: "asc" } },
      events: { select: { type: true, effectiveAt: true, createdAt: true, details: true }, orderBy: { createdAt: "asc" } },
      ledger: { select: { kind: true, delta: true, reason: true, createdAt: true }, orderBy: { createdAt: "asc" } },
      memberNotes: { select: { body: true, staffName: true, createdAt: true }, orderBy: { createdAt: "asc" } },
    },
  });
  return {
    exportedAt: new Date().toISOString(),
    gym: { name: gym.business.legalName, abn: gym.business.abn, contact: gym.business.email },
    note: "This is the personal information this gym holds about you in GymOS. Card details are held by Stripe, not the gym. Contact the gym to correct anything.",
    ...member,
  };
}

export interface DeletionBlocker {
  code: "active_membership" | "orders_in_progress";
  message: string;
}

// Reasons the account can't be erased yet. An active paid membership has to
// be cancelled first (under the gym's cancellation rules, so the member
// isn't billed for a membership they can't see), and orders still being
// prepared have to be finished or refunded.
export async function deletionBlockers(db: Db, memberId: string): Promise<DeletionBlocker[]> {
  const member = await db.member.findUniqueOrThrow({ where: { id: memberId }, select: { status: true, stripeSubscriptionId: true, cancelAt: true } });
  const blockers: DeletionBlocker[] = [];
  if (member.status !== "CANCELED" && member.status !== "PENDING") {
    blockers.push({
      code: "active_membership",
      message: member.cancelAt
        ? "Your membership ends on a set date. You can delete your account once it has ended."
        : "Cancel your membership first. You can delete your account once it has ended.",
    });
  }
  const openOrders = await db.order.count({ where: { memberId, status: { in: ["PAID", "PACKED", "READY_FOR_PICKUP", "SHIPPED"] } } });
  if (openOrders > 0) blockers.push({ code: "orders_in_progress", message: "You have shop orders still being prepared or delivered. Delete your account once they've arrived." });
  return blockers;
}

// Erases the member's personal details (APP 11.2 / 13) while keeping the
// records the law requires: payments, refunds and orders stay, with amounts
// and dates, so the gym's books and GST records still add up. Bookings,
// waitlist places and staff notes are removed. The member row stays as an
// anonymous owner for those records and can never sign in again.
export async function eraseMember(db: Db, actor: Actor, memberId: string) {
  const blockers = await deletionBlockers(db, memberId);
  if (blockers.length > 0) throw new ApiError("conflict", blockers[0].message);
  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.classBooking.deleteMany({ where: { memberId, class: { startTime: { gt: now } } } });
    await tx.classWaitlist.deleteMany({ where: { memberId } });
    await tx.memberNote.deleteMany({ where: { memberId } });
    await tx.order.updateMany({ where: { memberId }, data: { customerName: "Deleted member", email: `deleted-${memberId}@deleted.invalid` } });
    await tx.$executeRaw`UPDATE "Order" SET "shippingAddress" = NULL WHERE "memberId" = ${memberId}`;
    await tx.member.updateMany({ where: { referredById: memberId }, data: { referredById: null } });
    await tx.member.update({
      where: { id: memberId },
      data: {
        name: "Deleted member",
        email: `deleted-${memberId}@deleted.invalid`,
        passwordHash: null,
        notes: null,
        cancelReason: null,
        referredById: null,
        keycardIssued: false,
        notifyAnnouncements: false,
        notifyWaitlist: false,
        qrVersion: { increment: 1 },
        sessionVersion: { increment: 1 },
        archivedAt: now,
        anonymisedAt: now,
      },
    });
    // The audit log keeps what happened, but not who the person was.
    const rows = await tx.auditLog.findMany({
      where: { OR: [{ targetType: "Member", targetId: memberId }, { details: { path: ["actorMemberId"], equals: memberId } }] },
      select: { id: true, staffName: true, details: true },
    });
    for (const row of rows) {
      const details = scrubDetails(row.details);
      await tx.auditLog.update({
        where: { id: row.id },
        data: { ...(row.staffName.startsWith("Member: ") ? { staffName: `Member: ${ERASED}` } : {}), ...(details !== undefined ? { details } : {}) },
      });
    }
    await logAction(tx, actor.kind === "member" ? { kind: "system", name: "Member request" } : actor, { action: "member.erased", targetType: "Member", targetId: memberId });
  });
}

function scrubDetails(details: Prisma.JsonValue): Prisma.InputJsonValue | undefined {
  if (!details || typeof details !== "object" || Array.isArray(details)) return undefined;
  const copy = { ...details } as Record<string, Prisma.JsonValue>;
  let changed = false;
  for (const key of ["name", "email", "reason"]) {
    if (key in copy) {
      copy[key] = ERASED;
      changed = true;
    }
  }
  return changed ? (copy as Prisma.InputJsonValue) : undefined;
}
