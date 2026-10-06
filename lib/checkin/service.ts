import type { Db } from "@/lib/db";
import { ApiError } from "@/lib/http/errors";
import { logAction, type Actor } from "@/lib/audit";
import type { StaffActor } from "@/lib/auth/session";
import { withinGracePeriod } from "@/lib/billing/reminders";
import { looksLikePass, readPassToken } from "./qr";
import { MAIN_LOCATION_ID } from "@/lib/locations/constants";
import { defaultLocationFor } from "@/lib/locations/scope";
import { assertOpenLocation, memberMayUseLocation } from "@/lib/locations/members";
import { findLocationByCode } from "@/lib/locations/queries";

export type CheckInDecision = { granted: true; warning: string | null } | { granted: false; reason: string };

export async function accessDecision(
  db: Db,
  member: { id?: string; status: string; keycardIssued: boolean; archivedAt: Date | null; pastDueSince?: Date | null },
  now = new Date(),
  locationId?: string
): Promise<CheckInDecision> {
  if (member.archivedAt) return { granted: false, reason: "Membership archived" };
  // Allow-list rather than deny-list, so a status added later (like PENDING)
  // never lets someone in by default (R-02).
  if (member.status === "PAUSED") return { granted: false, reason: "Membership paused" };
  if (member.status === "CANCELED") return { granted: false, reason: "Membership cancelled" };
  if (member.status !== "ACTIVE" && member.status !== "PAST_DUE") return { granted: false, reason: "Membership not started" };
  let warning: string | null = null;
  if (member.status === "PAST_DUE") {
    // The owner sets a grace period; during it the member can still train.
    if (!withinGracePeriod(member.pastDueSince ?? null, now)) return { granted: false, reason: "Payment overdue" };
    warning = "Payment overdue. Ask them to update their card.";
  }
  // The plan must cover this location (D-126).
  if (locationId && member.id && !(await memberMayUseLocation(db, member.id, locationId))) return { granted: false, reason: "Membership doesn't include this location" };
  const settings = await db.gymSettings.findUnique({ where: { id: "singleton" } });
  if (settings?.requireKeycardForEntry && !member.keycardIssued) return { granted: false, reason: "No keycard issued" };
  return { granted: true, warning };
}

// Records a check-in only when entry is granted. A refused scan is logged in
// the audit trail but doesn't count as a visit.
export async function checkInMember(db: Db, actor: Actor, memberId: string, location: string, method: "MANUAL" | "QR" | "GATEWAY" = "MANUAL", locationId: string = MAIN_LOCATION_ID) {
  const member = await db.member.findUnique({
    where: { id: memberId },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      keycardIssued: true,
      archivedAt: true,
      pastDueSince: true,
      retentionScore: true,
      membershipPlan: { select: { name: true } },
    },
  });
  if (!member) throw new ApiError("not_found", "No member matches that.");
  const decision = await accessDecision(db, member, new Date(), locationId);
  await db.$transaction(async (tx) => {
    if (decision.granted) {
      await tx.checkIn.create({ data: { memberId: member.id, location, method, locationId } });
      await tx.member.update({ where: { id: member.id }, data: { lastCheckIn: new Date() } });
    }
    await logAction(tx, actor, {
      action: decision.granted ? "member.checked_in" : "member.check_in_refused",
      targetType: "Member",
      targetId: member.id,
      details: { location, locationId, method, ...(decision.granted ? {} : { reason: decision.reason }) },
    });
  });
  return { member, decision };
}

// A scanned pass that's turned away is recorded against the member, so the
// owner can see a shared screenshot being tried (R-34).
async function refusePass(db: Db, staff: StaffActor, memberId: string, desk: string, reason: string, message: string): Promise<never> {
  const exists = await db.member.findUnique({ where: { id: memberId }, select: { id: true } });
  if (exists) await logAction(db, staff, { action: "member.check_in_refused", targetType: "Member", targetId: memberId, details: { location: desk, method: "QR", reason } });
  throw new ApiError("conflict", message);
}

// Checks a scanned pass (D-119). It must be signed, current (issued in the
// last 90 seconds), for the member's current pass version, and not used
// before. Using it is claimed atomically, so two scans of one code can't both
// get in, and it counts as used even if entry is refused.
async function memberFromPass(db: Db, staff: StaffActor, token: string, desk: string): Promise<string> {
  const pass = await readPassToken(token);
  if (!pass.ok) {
    if (pass.reason === "old") throw new ApiError("conflict", "That's an old pass that no longer works. Ask the member to open their pass in the app, or find them by name.");
    if (pass.reason === "expired") {
      return refusePass(db, staff, pass.memberId, desk, "Expired pass", "That pass has expired. Ask the member to open their pass in the app for a fresh code. Screenshots don't work.");
    }
    throw new ApiError("not_found", "That pass isn't valid.");
  }
  const member = await db.member.findUnique({ where: { id: pass.memberId }, select: { id: true, qrVersion: true } });
  if (!member) throw new ApiError("not_found", "That pass isn't valid.");
  if (member.qrVersion !== pass.version) {
    return refusePass(db, staff, member.id, desk, "Replaced pass", "That pass has been replaced. Ask the member to open their current pass.");
  }
  const claimed = await db.member.updateMany({
    where: { id: member.id, OR: [{ passUsedIssuedAt: null }, { passUsedIssuedAt: { lt: pass.issuedAt } }] },
    data: { passUsedIssuedAt: pass.issuedAt },
  });
  if (claimed.count === 0) {
    return refusePass(db, staff, member.id, desk, "Pass already used", "That code has already been used. Ask the member to show the pass on their screen now; it refreshes every minute.");
  }
  return member.id;
}

// The front desk scans a QR pass, or types a member ID (also printed on
// keycards) or email. Without a pass, staff can find the member by name
// (searchForCheckIn) and check them in by ID. The desk's location is settled
// first (D-128), so a scan at a location the person's role doesn't cover
// never uses up the member's pass; then the pass rules (D-119) and the
// plan's location rules (D-126) both apply.
export async function checkInByQuery(db: Db, staff: StaffActor, query: string, requestedLocation?: string) {
  const locationId = defaultLocationFor(staff, requestedLocation);
  const desk = await assertOpenLocation(db, locationId);
  if (!desk) throw new ApiError("validation_failed", "Choose an open location for this desk.", { locationId: "Not found or archived" });
  const where = `Front desk, ${desk.name}`;
  if (looksLikePass(query)) {
    const memberId = await memberFromPass(db, staff, query, where);
    return { ...(await checkInMember(db, staff, memberId, where, "QR", desk.id)), method: "QR" as const };
  }
  const isEmail = query.includes("@");
  const found = await db.member.findFirst({ where: isEmail ? { email: query.toLowerCase() } : { id: query }, select: { id: true } });
  if (!found) throw new ApiError("not_found", "No member matches that ID or email. To look someone up by name, use Find a member.");
  return { ...(await checkInMember(db, staff, found.id, where, "MANUAL", desk.id)), method: "MANUAL" as const };
}

// A door gateway only knows the card's member ID. Returns null for a card
// that matches no member, which the door shows as unknown.
export async function checkInAtGateway(db: Db, memberId: string, location: string) {
  const exists = await db.member.findUnique({ where: { id: memberId }, select: { id: true } });
  if (!exists) return null;
  // The gateway names its location by code (D-125). An unknown code is
  // treated as the main location, so a misconfigured door still applies the
  // plan's rules rather than letting everyone in.
  const site = await findLocationByCode(db, location);
  return checkInMember(db, { kind: "system", name: `Gateway ${location}` }, exists.id, location, "GATEWAY", site?.id ?? MAIN_LOCATION_ID);
}
