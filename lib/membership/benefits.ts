import type { LedgerKind } from "@prisma/client";
import type { Db, Tx } from "@/lib/db";
import { ApiError } from "@/lib/http/errors";
import { currentCycle, type Cycle } from "./cycle";

export interface BenefitBalance {
  // null allowance means unlimited.
  allowance: number | null;
  adjustments: number;
  used: number;
  remaining: number | null;
}

export interface BenefitUsage {
  cycle: Cycle | null;
  classCredits: BenefitBalance;
  guestPasses: BenefitBalance;
  accountCreditCents: number;
}

type DbLike = Db | Tx;

async function loadMemberPlan(db: DbLike, memberId: string) {
  const member = await db.member.findUnique({
    where: { id: memberId },
    select: {
      id: true,
      createdAt: true,
      currentPeriodStart: true,
      currentPeriodEnd: true,
      membershipPlan: { select: { interval: true, classCreditsPerCycle: true, guestPassesPerCycle: true } },
    },
  });
  if (!member) throw new ApiError("not_found", "Member not found.");
  return member;
}

function balance(allowance: number | null, entries: { delta: number; refType: string | null }[]): BenefitBalance {
  const adjustments = entries.filter((e) => e.refType === "adjustment").reduce((s, e) => s + e.delta, 0);
  const used = -entries.filter((e) => e.refType !== "adjustment").reduce((s, e) => s + e.delta, 0);
  return { allowance, adjustments, used, remaining: allowance === null ? null : allowance + adjustments - used };
}

export async function getBenefitUsage(db: DbLike, memberId: string, now = new Date()): Promise<BenefitUsage> {
  const member = await loadMemberPlan(db, memberId);
  const plan = member.membershipPlan;
  const cycle = plan ? currentCycle(member, plan.interval, now) : null;
  const inCycle = cycle ? { gte: cycle.start, lt: cycle.end } : undefined;
  const [classEntries, guestEntries, credit] = await Promise.all([
    inCycle ? db.benefitLedger.findMany({ where: { memberId, kind: "CLASS_CREDIT", createdAt: inCycle }, select: { delta: true, refType: true } }) : [],
    inCycle ? db.benefitLedger.findMany({ where: { memberId, kind: "GUEST_PASS", createdAt: inCycle }, select: { delta: true, refType: true } }) : [],
    db.benefitLedger.aggregate({ where: { memberId, kind: "ACCOUNT_CREDIT" }, _sum: { delta: true } }),
  ]);
  return {
    cycle,
    classCredits: balance(plan ? plan.classCreditsPerCycle : 0, classEntries),
    guestPasses: balance(plan ? plan.guestPassesPerCycle : 0, guestEntries),
    accountCreditCents: credit._sum.delta ?? 0,
  };
}

// Uses one class credit for a booking, inside the booking transaction.
// Returns false when the plan has unlimited classes (nothing to use).
// Throws when the member has none left, unless staff override.
export async function useClassCredit(tx: Tx, memberId: string, classId: string, opts: { allowOverride?: boolean } = {}): Promise<boolean> {
  const usage = await getBenefitUsage(tx, memberId);
  if (usage.classCredits.remaining === null) return false;
  if (usage.classCredits.remaining <= 0) {
    if (opts.allowOverride) return false;
    throw new ApiError("conflict", "No class credits left this cycle. A manager can add credits, or book anyway as a casual visit.");
  }
  await tx.benefitLedger.create({ data: { memberId, kind: "CLASS_CREDIT", delta: -1, reason: "Class booking", refType: "booking", refId: classId } });
  return true;
}

export async function returnClassCredit(tx: Tx, memberId: string, classId: string) {
  await tx.benefitLedger.create({ data: { memberId, kind: "CLASS_CREDIT", delta: 1, reason: "Booking cancelled in time", refType: "booking_refund", refId: classId } });
}

export async function adjustBenefit(
  db: Db,
  input: { memberId: string; kind: LedgerKind; delta: number; reason: string; staffId: string }
) {
  return db.benefitLedger.create({
    data: { memberId: input.memberId, kind: input.kind, delta: input.delta, reason: input.reason, refType: "adjustment", staffId: input.staffId },
  });
}
