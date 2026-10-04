// All money is integer cents in AUD. Prices shown to members are GST-inclusive.
// GST in Australia is 10% of the GST-exclusive price, so the GST contained in
// an inclusive price is 1/11 of it. Rounded to the nearest cent.

export const GST_RATE = 0.1;

export function gstFromInclusive(inclusiveCents: number, gstRegistered = true): number {
  assertCents(inclusiveCents);
  if (!gstRegistered) return 0;
  return Math.round(inclusiveCents / 11);
}

export function splitInclusive(inclusiveCents: number, gstRegistered = true) {
  const gst = gstFromInclusive(inclusiveCents, gstRegistered);
  return { inclusive: inclusiveCents, gst, exclusive: inclusiveCents - gst };
}

// Applies a percentage discount to an inclusive price, rounding to the cent.
export function applyDiscount(inclusiveCents: number, percent: number): number {
  assertCents(inclusiveCents);
  if (percent < 0 || percent > 100) throw new RangeError("Discount must be between 0 and 100");
  return Math.round(inclusiveCents * (1 - percent / 100));
}

const audFormatter = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });
const audWholeFormatter = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatAud(cents: number, opts: { whole?: boolean } = {}): string {
  // Avoid "-$0.00" for negative zero.
  const dollars = cents === 0 ? 0 : cents / 100;
  return opts.whole ? audWholeFormatter.format(dollars) : audFormatter.format(dollars);
}

// "$29.95" or "29.95" -> 2995. Returns null for anything that isn't a
// non-negative amount with at most two decimal places.
export function parseDollarsToCents(input: string): number | null {
  const trimmed = input.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

function assertCents(value: number) {
  if (!Number.isInteger(value) || value < 0) throw new RangeError(`Expected non-negative integer cents, got ${value}`);
}

export const INTERVAL_LABELS = {
  WEEK: { noun: "week", adverb: "weekly" },
  FORTNIGHT: { noun: "fortnight", adverb: "fortnightly" },
  MONTH: { noun: "month", adverb: "monthly" },
  YEAR: { noun: "year", adverb: "yearly" },
} as const;

export function formatPlanPrice(cents: number, interval: keyof typeof INTERVAL_LABELS): string {
  return `${formatAud(cents)} per ${INTERVAL_LABELS[interval].noun}`;
}

// Monthly-equivalent value for MRR. 52 weeks / 12 months.
export function monthlyEquivalentCents(cents: number, interval: keyof typeof INTERVAL_LABELS): number {
  switch (interval) {
    case "WEEK":
      return Math.round((cents * 52) / 12);
    case "FORTNIGHT":
      return Math.round((cents * 26) / 12);
    case "MONTH":
      return cents;
    case "YEAR":
      return Math.round(cents / 12);
  }
}
