import type { Plan } from "@prisma/client";

// Monthly price in cents, per plan. Single source of truth for checkout and revenue reporting.
export const PLAN_PRICES: Record<Plan, number> = {
  BASIC: 2900,
  PREMIUM: 4900,
  PLATINUM: 9900,
  ELITE: 19900,
};

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "usd",
    maximumFractionDigits: 0,
  });
}
