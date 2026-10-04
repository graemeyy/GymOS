import type { Db, Tx } from "@/lib/db";
import { DAY_MS } from "@/lib/time";

// What the member's own membership screen needs to work out their options.
export function getMembershipForMember(db: Db, memberId: string) {
  return db.member.findUniqueOrThrow({
    where: { id: memberId },
    select: {
      status: true,
      createdAt: true,
      currentPeriodStart: true,
      currentPeriodEnd: true,
      stripeSubscriptionId: true,
      planId: true,
      pendingPlanId: true,
      cancelAt: true,
      pausedFrom: true,
      pausedUntil: true,
      membershipPlan: { select: { priceCents: true, interval: true } },
    },
  });
}

// The pause limit counts pauses booked in the 12 months before `now`.
export function countPausesInLastYear(db: Db | Tx, memberId: string, now: Date) {
  return db.membershipEvent.count({ where: { memberId, type: "PAUSE_SCHEDULED", createdAt: { gte: new Date(now.getTime() - 365 * DAY_MS) } } });
}

export function listMembershipEvents(db: Db, memberId: string) {
  return db.membershipEvent.findMany({ where: { memberId }, orderBy: { createdAt: "desc" }, take: 50 });
}

export function listBenefitHistory(db: Db, memberId: string) {
  return db.benefitLedger.findMany({ where: { memberId }, orderBy: { createdAt: "desc" }, take: 50 });
}
