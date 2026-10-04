import type { MembershipPlan } from "@prisma/client";
import { prisma, type Db } from "@/lib/db";
import { gym, type PlanBenefits } from "@/lib/config";

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

// Creates plans from config that don't exist yet, with their benefits. Never
// overwrites a plan the owner has edited in the app, and never deletes one.
export async function syncPlansFromConfig(db: Db = prisma): Promise<{ created: string[] }> {
  const created: string[] = [];
  for (const [index, plan] of gym.plans.entries()) {
    const existing = await db.membershipPlan.findUnique({ where: { slug: plan.slug } });
    if (existing) continue;
    await db.membershipPlan.create({
      data: {
        slug: plan.slug,
        name: plan.name,
        description: plan.description,
        priceCents: plan.priceCents,
        interval: plan.interval,
        sortOrder: 100 + index,
        ...plan.benefits,
      },
    });
    created.push(plan.slug);
  }
  return { created };
}
