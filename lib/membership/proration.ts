// Proration for a mid-cycle plan change: the difference in price, scaled by
// how much of the current cycle is left. Positive means the member owes more
// now; negative means a credit. Rounded to the cent.
export function prorationCents(oldPriceCents: number, newPriceCents: number, cycleStart: Date, cycleEnd: Date, now = new Date()): number {
  const total = cycleEnd.getTime() - cycleStart.getTime();
  if (total <= 0) return 0;
  const remaining = Math.min(Math.max(cycleEnd.getTime() - now.getTime(), 0), total);
  return Math.round(((newPriceCents - oldPriceCents) * remaining) / total);
}
