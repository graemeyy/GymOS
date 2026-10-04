import type { BillingInterval } from "@prisma/client";
import { gym } from "@/lib/config";
import { partsIn, zonedTimeToUtc } from "@/lib/dates";

const pad = (n: number) => String(n).padStart(2, "0");

// Adds billing intervals in the gym's local calendar, keeping the local time
// of day. Months clamp to the month's last day (31 Jan + 1 month = 28/29 Feb).
export function addInterval(date: Date, interval: BillingInterval, count = 1, timeZone = "UTC"): Date {
  const p = partsIn(date, timeZone);
  let year = p.year;
  let month = p.month;
  let day = p.day;
  if (interval === "WEEK" || interval === "FORTNIGHT") {
    const shifted = new Date(Date.UTC(year, month - 1, day + (interval === "WEEK" ? 7 : 14) * count));
    year = shifted.getUTCFullYear();
    month = shifted.getUTCMonth() + 1;
    day = shifted.getUTCDate();
  } else {
    const months = (interval === "YEAR" ? 12 : 1) * count;
    const first = new Date(Date.UTC(year, month - 1 + months, 1));
    year = first.getUTCFullYear();
    month = first.getUTCMonth() + 1;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    day = Math.min(day, lastDay);
  }
  const atMinute = zonedTimeToUtc(`${year}-${pad(month)}-${pad(day)}`, `${pad(p.hour)}:${pad(p.minute)}`, timeZone);
  return new Date(atMinute.getTime() + p.second * 1000 + date.getUTCMilliseconds());
}

export interface Cycle {
  start: Date;
  end: Date;
}

// The member's current billing cycle. Stripe's period wins when we have it;
// otherwise cycles roll forward from an anchor (the last known period end, or
// when the membership started). Each cycle is counted from the anchor, not
// from the previous cycle, so a month clamped to the 28th returns to the 31st
// afterwards (R-29).
export function currentCycle(
  member: { createdAt: Date; membershipStartedAt?: Date | null; currentPeriodStart: Date | null; currentPeriodEnd: Date | null },
  interval: BillingInterval,
  now = new Date(),
  timeZone = gym.business.timezone
): Cycle {
  if (member.currentPeriodStart && member.currentPeriodEnd && member.currentPeriodStart <= now && now < member.currentPeriodEnd) {
    return { start: member.currentPeriodStart, end: member.currentPeriodEnd };
  }
  const anchor = member.currentPeriodEnd && member.currentPeriodEnd <= now ? member.currentPeriodEnd : (member.membershipStartedAt ?? member.createdAt);
  let n = 0;
  let start = anchor;
  let end = addInterval(anchor, interval, 1, timeZone);
  // Bounded loop: at most a few thousand weekly cycles in a decade.
  while (end <= now && n < 10_000) {
    n++;
    start = end;
    end = addInterval(anchor, interval, n + 1, timeZone);
  }
  return { start, end };
}
