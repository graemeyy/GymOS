import type { BillingInterval } from "@prisma/client";

export function stripeRecurring(interval: BillingInterval): { interval: "week" | "month" | "year"; interval_count: number } {
  switch (interval) {
    case "WEEK":
      return { interval: "week", interval_count: 1 };
    case "FORTNIGHT":
      return { interval: "week", interval_count: 2 };
    case "MONTH":
      return { interval: "month", interval_count: 1 };
    case "YEAR":
      return { interval: "year", interval_count: 1 };
  }
}
