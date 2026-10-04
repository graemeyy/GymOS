import type { Db } from "@/lib/db";
import { ApiError } from "@/lib/http/errors";
import { logAction, type Actor } from "@/lib/audit";
import { withinGracePeriod } from "@/lib/billing/reminders";

export type CheckInDecision = { granted: true; warning: string | null } | { granted: false; reason: string };

export async function accessDecision(
  db: Db,
  member: { status: string; keycardIssued: boolean; archivedAt: Date | null; pastDueSince?: Date | null },
  now = new Date()
): Promise<CheckInDecision> {
  if (member.archivedAt) return { granted: false, reason: "Membership archived" };
  if (member.status === "PAUSED") return { granted: false, reason: "Membership paused" };
  if (member.status === "CANCELED") return { granted: false, reason: "Membership cancelled" };
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
  if (decision.granted) {
    await db.$transaction([
      db.checkIn.create({ data: { memberId: member.id, location, method } }),
      db.member.update({ where: { id: member.id }, data: { lastCheckIn: new Date() } }),
    ]);
  }
  await logAction(db, actor, {
    action: decision.granted ? "member.checked_in" : "member.check_in_refused",
    targetType: "Member",
    targetId: member.id,
    details: { location, method, ...(decision.granted ? {} : { reason: decision.reason }) },
  });
  return { member, decision };
}
