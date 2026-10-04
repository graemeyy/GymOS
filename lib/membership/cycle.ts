import type { BillingInterval } from "@prisma/client";

export function addInterval(date: Date, interval: BillingInterval, count = 1): Date {
  const d = new Date(date.getTime());
  switch (interval) {
    case "WEEK":
      d.setUTCDate(d.getUTCDate() + 7 * count);
      return d;
    case "FORTNIGHT":
      d.setUTCDate(d.getUTCDate() + 14 * count);
      return d;
    case "MONTH": {
      // Clamp to the last day of the month (31 Jan + 1 month = 28/29 Feb).
      const day = d.getUTCDate();
      d.setUTCDate(1);
      d.setUTCMonth(d.getUTCMonth() + count);
      const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
      d.setUTCDate(Math.min(day, last));
      return d;
    }
    case "YEAR":
      return addInterval(date, "MONTH", 12 * count);
  }
}

export interface Cycle {
  start: Date;
  end: Date;
}

// The member's current billing cycle. Stripe's period wins when we have it;
// otherwise cycles roll forward from the join date (members billed outside
// Stripe, or before their first invoice).
export function currentCycle(
  member: { createdAt: Date; currentPeriodStart: Date | null; currentPeriodEnd: Date | null },
  interval: BillingInterval,
  now = new Date()
): Cycle {
  if (member.currentPeriodStart && member.currentPeriodEnd && member.currentPeriodStart <= now && now < member.currentPeriodEnd) {
    return { start: member.currentPeriodStart, end: member.currentPeriodEnd };
  }
  const anchor = member.currentPeriodEnd && member.currentPeriodEnd <= now ? member.currentPeriodEnd : member.createdAt;
  let start = anchor;
  let end = addInterval(start, interval);
  // Bounded loop: at most a few thousand weekly cycles in a decade.
  for (let i = 0; end <= now && i < 10_000; i++) {
    start = end;
    end = addInterval(start, interval);
  }
  return { start, end };
}
