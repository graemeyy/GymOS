import { formatAud, INTERVAL_LABELS, type Interval } from "@/lib/money";

export interface PerkBenefits {
  classCreditsPerCycle: number | null;
  guestPassesPerCycle: number;
  shopDiscountPercent: number;
  guestRateCents?: number | null;
}

// What a plan includes, in the words members see. One wording everywhere:
// the home page, sign-up and the staff plans list (R-100). Safe in the browser.
export function planPerks(benefits: PerkBenefits, interval: Interval, opts: { includeGuestRate?: boolean } = {}): string[] {
  const noun = INTERVAL_LABELS[interval].noun;
  const credits = benefits.classCreditsPerCycle;
  return [
    credits === null ? "Unlimited classes" : credits > 0 ? `${credits} classes per ${noun}` : "Gym floor only",
    benefits.guestPassesPerCycle > 0 ? `${benefits.guestPassesPerCycle} guest pass per ${noun}` : null,
    benefits.shopDiscountPercent > 0 ? `${benefits.shopDiscountPercent}% off in the shop` : null,
    opts.includeGuestRate && benefits.guestRateCents ? `Guests ${formatAud(benefits.guestRateCents)}` : null,
  ].filter((p): p is string => p !== null);
}
