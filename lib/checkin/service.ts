import type { Db } from "@/lib/db";
import { ApiError } from "@/lib/http/errors";
import { logAction, type Actor } from "@/lib/audit";
import type { StaffActor } from "@/lib/auth/session";
import { withinGracePeriod } from "@/lib/billing/reminders";
import { readPassToken } from "./qr";

export type CheckInDecision = { granted: true; warning: string | null } | { granted: false; reason: string };

export async function accessDecision(
  db: Db,
  member: { status: string; keycardIssued: boolean; archivedAt: Date | null; pastDueSince?: Date | null },
  now = new Date()
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
  const settings = await db.gymSettings.findUnique({ where: { id: "singleton" } });
  if (settings?.requireKeycardForEntry && !member.keycardIssued) return { granted: false, reason: "No keycard issued" };
  return { granted: true, warning };
}

// Records a check-in only when entry is granted. A refused scan is logged in
// the audit trail but doesn't count as a visit.
export async function checkInMember(db: Db, actor: Actor, memberId: string, location: string, method: "MANUAL" | "QR" | "GATEWAY" = "MANUAL") {
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
  const decision = await accessDecision(db, member);
  await db.$transaction(async (tx) => {
    if (decision.granted) {
      await tx.checkIn.create({ data: { memberId: member.id, location, method } });
      await tx.member.update({ where: { id: member.id }, data: { lastCheckIn: new Date() } });
    }
    await logAction(tx, actor, {
      action: decision.granted ? "member.checked_in" : "member.check_in_refused",
      targetType: "Member",
      targetId: member.id,
      details: { location, method, ...(decision.granted ? {} : { reason: decision.reason }) },
    });
  });
  return { member, decision };
}

// The front desk scans a QR pass or types a member ID or email. A pass that
// has been reissued since it was shown is refused, so a shared screenshot
// stops working.
export async function checkInByQuery(db: Db, staff: StaffActor, query: string) {
  let memberId: string | null = null;
  let method: "MANUAL" | "QR" = "MANUAL";
  if (query.startsWith("GYM1.")) {
    const pass = await readPassToken(query);
    if (!pass) throw new ApiError("not_found", "That pass isn't valid.");
    const member = await db.member.findUnique({ where: { id: pass.m }, select: { id: true, qrVersion: true } });
    if (!member || member.qrVersion !== pass.v) throw new ApiError("conflict", "That pass has been replaced. Ask the member to open their current pass.");
    memberId = member.id;
    method = "QR";
  } else {
    const isEmail = query.includes("@");
    const found = await db.member.findFirst({ where: isEmail ? { email: query.toLowerCase() } : { id: query }, select: { id: true } });
    if (!found) throw new ApiError("not_found", "No member matches that ID or email.");
    memberId = found.id;
  }
  return { ...(await checkInMember(db, staff, memberId, "Front desk", method)), method };
}

// A door gateway only knows the card's member ID. Returns null for a card
// that matches no member, which the door shows as unknown.
export async function checkInAtGateway(db: Db, memberId: string, location: string) {
  const exists = await db.member.findUnique({ where: { id: memberId }, select: { id: true } });
  if (!exists) return null;
  return checkInMember(db, { kind: "system", name: `Gateway ${location}` }, exists.id, location, "GATEWAY");
}
