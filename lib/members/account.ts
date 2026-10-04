import type { Db } from "@/lib/db";
import type { MemberActor } from "@/lib/auth/session";
import { gym } from "@/lib/config";
import { ApiError } from "@/lib/http/errors";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { logAction, type Actor } from "@/lib/audit";
import { recordAcceptance } from "@/lib/legal";
import { releaseFutureBookings } from "@/lib/classes/service";

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
  if (next === current) throw new ApiError("validation_failed", "Choose a password that's different from your current one.", { next: "Same as your current password" });
  const passwordHash = await hashPassword(next);
  return db.$transaction(async (tx) => {
    // Bumping the session version signs out every other device; the caller
    // issues a fresh cookie for this one.
    const updated = await tx.member.update({
      where: { id: memberId },
      data: { passwordHash, mustChangePassword: false, sessionVersion: { increment: 1 } },
      select: { sessionVersion: true },
    });
    await logAction(tx, { kind: "member", id: memberId, name: member.name ?? member.email, email: member.email }, { action: "member.password_changed", targetType: "Member", targetId: memberId });
    return updated.sessionVersion;
  });
}

// Everything GymOS holds about the member (Privacy Act, APP 12), as plain
// data. Staff notes are included: they are personal information about the
// member. Internal fields (password hash, session version, retention score
// inputs) are not information about the person and are left out. Each
// export is audited.
export async function exportMemberData(db: Db, actor: MemberActor) {
  const member = await db.member.findUniqueOrThrow({
    where: { id: actor.id },
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
  await logAction(db, actor, { action: "member.data_exported", targetType: "Member", targetId: actor.id });
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

// The member deletes their own account. The password is asked for again so
// an unlocked phone isn't enough to erase someone.
export async function deleteOwnAccount(db: Db, member: MemberActor, password: string) {
  const record = await db.member.findUniqueOrThrow({ where: { id: member.id }, select: { passwordHash: true } });
  if (!record.passwordHash || !(await verifyPassword(password, record.passwordHash))) {
    throw new ApiError("validation_failed", "That password isn't right.", { password: "Doesn't match" });
  }
  await eraseMember(db, member, member.id);
}

// Erases the member's personal details (APP 11.2 / 13) while keeping the
// records the law requires: payments, refunds and orders stay, with amounts
// and dates, so the gym's books and GST records still add up. Bookings,
// waitlist places and staff notes are removed. The member row stays as an
// anonymous owner for those records and can never sign in again.
export async function eraseMember(db: Db, actor: Actor, memberId: string) {
  const blockers = await deletionBlockers(db, memberId);
  if (blockers.length > 0) throw new ApiError("conflict", blockers[0].message);
  await anonymiseMember(db, actor.kind === "member" ? { kind: "system", name: "Member request" } : actor, memberId);
}

// The erasure itself, without the checks. Also used by the retention job for
// members archived longer than the gym keeps personal details.
export async function anonymiseMember(db: Db, actor: Actor, memberId: string) {
  // Future bookings are released the way a staff cancellation would, so
  // credits come back and the waitlist moves up (R-39).
  await releaseFutureBookings(db, actor, memberId);
  const now = new Date();
  await db.$transaction(async (tx) => {
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
    // The audit log keeps what happened, but not who the person was. Two
    // set-based statements instead of one update per row (R-47).
    await tx.$executeRaw`
      UPDATE "AuditLog" SET "staffName" = ${`Member: ${ERASED}`}
      WHERE "details"->>'actorMemberId' = ${memberId} AND "staffName" LIKE 'Member: %'`;
    await tx.$executeRaw`
      UPDATE "AuditLog" SET "details" = (
        SELECT jsonb_object_agg(k, CASE WHEN k IN ('name', 'email', 'reason') THEN to_jsonb(${ERASED}::text) ELSE v END)
        FROM jsonb_each("details") AS e(k, v)
      )
      WHERE "targetType" = 'Member' AND "targetId" = ${memberId}
        AND jsonb_typeof("details") = 'object' AND "details" ?| array['name', 'email', 'reason']`;
    await logAction(tx, actor, { action: "member.erased", targetType: "Member", targetId: memberId });
  });
}
