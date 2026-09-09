import type { Plan, PrismaClient } from "@prisma/client";

// Default monthly price in cents, per plan. Used as a fallback until a
// PlanPrice row exists (e.g. right after the migration, before Settings has
// ever been saved) and as the seed data.
export const PLAN_PRICES: Record<Plan, number> = {
  BASIC: 2900,
  PREMIUM: 4900,
  PLATINUM: 9900,
  ELITE: 19900,
};

export async function getPlanPrices(prisma: PrismaClient): Promise<Record<Plan, number>> {
  const rows = await prisma.planPrice.findMany();
  const prices = { ...PLAN_PRICES };
  for (const row of rows) {
    prices[row.plan] = row.priceCents;
  }
  return prices;
}

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "usd",
    maximumFractionDigits: 0,
  });
}
