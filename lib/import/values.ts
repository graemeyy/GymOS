// Reading the values gym systems export, the forgiving way: Australian dates
// as well as ISO ones, prices with or without a dollar sign, "Monthly" as
// well as "month". Each returns null for something it can't read, and the
// caller says what was expected.

export type Interval = "WEEK" | "FORTNIGHT" | "MONTH" | "YEAR";

/** A calendar date as YYYY-MM-DD, from 2024-03-01, 1/3/2024 or 01-03-24 (day first). */
export function parseDate(input: string): string | null {
  const value = input.trim();
  let y: number, m: number, d: number;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(value);
  const dayFirst = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(value);
  if (iso) {
    [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else if (dayFirst) {
    [d, m, y] = [Number(dayFirst[1]), Number(dayFirst[2]), Number(dayFirst[3])];
    if (y < 100) y += 2000;
  } else {
    return null;
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  if (y < 1990 || y > 2100) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Dollars to cents: "29.95", "$29.95", "1,200", "29" (two decimal places at most). */
export function parseMoney(input: string): number | null {
  const value = input.trim().replace(/^\$\s*/, "").replace(/,(?=\d{3}(\D|$))/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const [whole, frac = ""] = value.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

const INTERVALS: Record<string, Interval> = {
  week: "WEEK",
  weekly: "WEEK",
  wk: "WEEK",
  "1 week": "WEEK",
  fortnight: "FORTNIGHT",
  fortnightly: "FORTNIGHT",
  "2 weeks": "FORTNIGHT",
  biweekly: "FORTNIGHT",
  month: "MONTH",
  monthly: "MONTH",
  mth: "MONTH",
  "1 month": "MONTH",
  year: "YEAR",
  yearly: "YEAR",
  annual: "YEAR",
  annually: "YEAR",
  "12 months": "YEAR",
};

export function parseInterval(input: string): Interval | null {
  return INTERVALS[input.trim().toLowerCase().replace(/^per\s+|^every\s+/, "")] ?? null;
}

/** A whole number in a range; empty is the default. */
export function parseCount(input: string, max: number, empty = 0): number | null {
  const value = input.trim();
  if (value === "") return empty;
  if (!/^\d+$/.test(value)) return null;
  const n = Number(value);
  return n <= max ? n : null;
}

/** Class credits: a number, or "unlimited" (null). Empty is none. */
export function parseClassCredits(input: string): number | null | "invalid" {
  const value = input.trim().toLowerCase();
  if (value === "unlimited" || value === "∞" || value === "any") return null;
  const n = parseCount(value, 1000);
  return n === null ? "invalid" : n;
}

export function parseStatus(input: string): "ACTIVE" | "PAUSED" | null {
  const value = input.trim().toLowerCase();
  if (value === "" || value === "active" || value === "current" || value === "live") return "ACTIVE";
  if (value === "paused" || value === "suspended" || value === "on hold" || value === "frozen") return "PAUSED";
  return null;
}
