import { DAY_MS } from "@/lib/time";

/** Members scoring below this are flagged as likely to leave. */
export const AT_RISK_BELOW = 40;

// Retention score, 0 to 100. Half from how recently the member visited, half
// from how often they came in the last 30 days, minus a penalty for classes
// they booked and didn't attend.
export function retentionScore(
  input: { lastCheckIn: Date | null; visitsLast30Days: number; noShowsLast30Days: number },
  now = new Date()
): number {
  let score = 0;
  if (input.lastCheckIn) {
    const days = (now.getTime() - input.lastCheckIn.getTime()) / DAY_MS;
    if (days <= 3) score += 50;
    else if (days <= 7) score += 30;
    else if (days <= 14) score += 10;
  }
  if (input.visitsLast30Days >= 12) score += 50;
  else if (input.visitsLast30Days >= 8) score += 35;
  else if (input.visitsLast30Days >= 4) score += 15;
  score -= Math.min(input.noShowsLast30Days * 5, 20);
  return Math.max(0, Math.min(100, score));
}
