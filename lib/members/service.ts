import type { Db } from "@/lib/db";
import type { MemberActor, StaffActor } from "@/lib/auth/session";
import { ApiError } from "@/lib/http/errors";
import { getStripe } from "@/lib/billing/stripe";
import { logAction, type Actor } from "@/lib/audit";
import { releaseFutureBookings } from "@/lib/classes/service";
import { markPaidAtDesk, setPlanAtDesk, startMembership } from "@/lib/membership/service";
import { getMemberListItem } from "./queries";
import type { CreateMemberInput, ProfileInput, UpdateMemberInput } from "./schema";
import { MAIN_LOCATION_ID } from "@/lib/locations/constants";
import { assertOpenLocation } from "@/lib/locations/members";

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

  // Like a staff cancellation: credits come back and the waitlist moves up (R-39).
  await releaseFutureBookings(db, actor, memberId);
  const now = new Date();
  await db.$transaction(async (tx) => {
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

// Needs members.edit (checked by the route). A member added with a plan pays
// at the desk and starts straight away; without one they're PENDING (no
// access) until a plan is started or they pay online (R-36, D-100).
// A member's home location must be open (D-125).
export async function assertHomeLocation(db: Db, locationId: string) {
  if (!(await assertOpenLocation(db, locationId))) throw new ApiError("validation_failed", "Choose an open location.", { homeLocationId: "Not found or archived" });
}

export async function createMember(db: Db, staff: StaffActor, input: CreateMemberInput) {
  await assertReferrer(db, input.referredById);
  await assertPlan(db, input.planId);
  const homeLocationId = input.homeLocationId ?? MAIN_LOCATION_ID;
  await assertHomeLocation(db, homeLocationId);
  const existing = await db.member.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existing) throw new ApiError("conflict", "A member with that email already exists.", { email: "Already in use" });
  return db.$transaction(async (tx) => {
    const row = await tx.member.create({
      // Staff add members in person, so the address is taken as confirmed (D-114).
      data: { name: input.name, email: input.email, planId: input.planId ?? null, referredById: input.referredById ?? null, status: "PENDING", emailVerifiedAt: new Date(), homeLocationId },
      select: { id: true, planId: true, referredById: true },
    });
    await logAction(tx, staff, {
      action: "member.created",
      targetType: "Member",
      targetId: row.id,
      details: { name: input.name, email: input.email, planId: row.planId, referredById: row.referredById },
    });
    if (input.planId) await startMembership(tx, staff, row.id, input.planId);
    return getMemberListItem(tx, row.id);
  });
}

// Needs members.edit (checked by the route), which covers details, plan and
// status. Status and plan go through the membership service so history,
// dates and Stripe stay consistent (R-06); pausing and cancelling have their
// own actions.
export async function updateMember(db: Db, staff: StaffActor, memberId: string, input: UpdateMemberInput) {
  const existing = await db.member.findUnique({ where: { id: memberId }, select: { id: true, status: true, planId: true, archivedAt: true } });
  if (!existing) throw new ApiError("not_found", "Member not found.");
  if (existing.archivedAt) throw new ApiError("conflict", "This member is archived and can't be edited.");

  const { status, planId, ...details } = input;
  const statusChange = status !== undefined && status !== existing.status ? status : undefined;
  const planChange = planId !== undefined && planId !== existing.planId;
  if (statusChange && statusChange !== "ACTIVE") {
    throw new ApiError("validation_failed", "Use Pause or Cancel on the membership panel to change this.", { status: "Use the membership actions" });
  }
  await assertReferrer(db, details.referredById, memberId);
  await assertPlan(db, planId);
  if (details.homeLocationId) await assertHomeLocation(db, details.homeLocationId);
  if (details.email) {
    const clash = await db.member.findUnique({ where: { email: details.email }, select: { id: true } });
    if (clash && clash.id !== memberId) throw new ApiError("conflict", "Another member already uses that email.", { email: "Already in use" });
  }

  return db.$transaction(async (tx) => {
    if (statusChange === "ACTIVE") {
      if (existing.status === "PAST_DUE") await markPaidAtDesk(tx, staff, memberId);
      else await startMembership(tx, staff, memberId, planId ?? existing.planId);
    } else if (planChange) {
      await setPlanAtDesk(tx, staff, memberId, planId ?? null);
    }
    if (Object.keys(details).length > 0) {
      await tx.member.update({ where: { id: memberId }, data: details });
      await logAction(tx, staff, { action: "member.updated", targetType: "Member", targetId: memberId, details: { changed: Object.keys(details) } });
    }
    return tx.member.findUniqueOrThrow({
      where: { id: memberId },
      select: { id: true, name: true, email: true, status: true, planId: true, notes: true, referredById: true, keycardIssued: true, homeLocationId: true },
    });
  });
}

// Notes are append-only: they record who said what and when.
export function addMemberNote(db: Db, staff: StaffActor, memberId: string, body: string) {
  return db.$transaction(async (tx) => {
    const member = await tx.member.findUnique({ where: { id: memberId }, select: { id: true } });
    if (!member) throw new ApiError("not_found", "Member not found.");
    const note = await tx.memberNote.create({ data: { memberId, staffId: staff.id, staffName: staff.name, body } });
    await logAction(tx, staff, { action: "member.note_added", targetType: "Member", targetId: memberId, details: { noteId: note.id } });
    return note;
  });
}

export function reissuePass(db: Db, staff: StaffActor, memberId: string) {
  return db.$transaction(async (tx) => {
    const member = await tx.member.update({ where: { id: memberId }, data: { qrVersion: { increment: 1 } }, select: { id: true, qrVersion: true } });
    await logAction(tx, staff, { action: "member.pass_reissued", targetType: "Member", targetId: memberId, details: { version: member.qrVersion } });
  });
}

// Members can change their name and email preferences. Email address changes
// go through the front desk until email verification exists, so a typo can't
// lock someone out or move their account to an address they don't own.
export function updateMemberProfile(db: Db, member: MemberActor, input: ProfileInput) {
  return db.$transaction(async (tx) => {
    const updated = await tx.member.update({ where: { id: member.id }, data: input, select: { name: true, notifyAnnouncements: true, notifyWaitlist: true } });
    await logAction(tx, member, { action: "member.profile_updated", targetType: "Member", targetId: member.id, details: { changed: Object.keys(input) } });
    return updated;
  });
}

// The welcome steps are done once, so a repeat call keeps the first date.
export async function markOnboarded(db: Db, memberId: string) {
  await db.member.updateMany({ where: { id: memberId, onboardedAt: null }, data: { onboardedAt: new Date() } });
}
