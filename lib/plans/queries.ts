import type { MembershipPlan } from "@prisma/client";
import { prisma, type Db } from "@/lib/db";
import type { PlanBenefits } from "@/lib/config";

export const planSelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  priceCents: true,
  interval: true,
  active: true,
  sortOrder: true,
  classCreditsPerCycle: true,
  guestPassesPerCycle: true,
  shopDiscountPercent: true,
  guestRateCents: true,
  locationAccess: true,
} as const;

export type PlanSummary = Pick<MembershipPlan, keyof typeof planSelect>;

export function benefitsOf(plan: Pick<MembershipPlan, "classCreditsPerCycle" | "guestPassesPerCycle" | "shopDiscountPercent" | "guestRateCents"> | null | undefined): PlanBenefits {
  if (!plan) return { classCreditsPerCycle: 0, guestPassesPerCycle: 0, shopDiscountPercent: 0, guestRateCents: 0 };
  return {
    classCreditsPerCycle: plan.classCreditsPerCycle,
    guestPassesPerCycle: plan.guestPassesPerCycle,
    shopDiscountPercent: plan.shopDiscountPercent,
    guestRateCents: plan.guestRateCents,
  };
}

export async function listPlans(db: Db = prisma, opts: { includeInactive?: boolean } = {}): Promise<PlanSummary[]> {
  return db.membershipPlan.findMany({
    where: opts.includeInactive ? undefined : { active: true },
    orderBy: [{ sortOrder: "asc" }, { priceCents: "asc" }],
    select: planSelect,
  });
}

// All plans, including retired ones, with member counts. Counts are null
// when revenue is hidden, because price times count is the revenue (R-43).
export async function listPlansWithMemberCounts(db: Db, showMemberCounts: boolean) {
  const plans = await listPlans(db, { includeInactive: true });
  // Which locations each "selected locations" plan covers (D-126).
  const links = await db.planLocation.findMany({ where: { planId: { in: plans.map((p) => p.id) } }, select: { planId: true, locationId: true } });
  const withLocations = plans.map((p) => ({ ...p, locationIds: links.filter((l) => l.planId === p.id).map((l) => l.locationId) }));
  if (!showMemberCounts) return withLocations.map((p) => ({ ...p, memberCount: null }));
  const counts = await db.member.groupBy({ by: ["planId"], where: { archivedAt: null, status: { not: "CANCELED" } }, _count: { _all: true } });
  const byPlan = new Map(counts.map((c) => [c.planId, c._count._all]));
  return withLocations.map((p) => ({ ...p, memberCount: byPlan.get(p.id) ?? 0 }));
}
