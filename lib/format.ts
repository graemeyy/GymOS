import { gym } from "@/lib/config/client";
import { DAY_MS } from "@/lib/time";

// Display formatting, in the gym's time zone so staff and members elsewhere
// still see gym-local dates. Safe on the server and in the browser.
const tz = gym.business.timezone;

const formatter = (options: Intl.DateTimeFormatOptions) => {
  const f = new Intl.DateTimeFormat("en-AU", { timeZone: tz, ...options });
  return (v: string | Date) => f.format(new Date(v));
};

/** 2 Oct 2026 */
export const fmtDate = formatter({ day: "numeric", month: "short", year: "numeric" });
/** 2 October 2026 */
export const fmtLongDate = formatter({ day: "numeric", month: "long", year: "numeric" });
/** Fri 2 Oct, 6:00 am */
export const fmtDateTime = formatter({ weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
/** 6:00 am */
export const fmtTime = formatter({ hour: "numeric", minute: "2-digit" });
/** Friday 2 October */
export const fmtDayHeading = formatter({ weekday: "long", day: "numeric", month: "long" });

const weekdayOfDate = new Intl.DateTimeFormat("en-AU", { weekday: "short", timeZone: "UTC" });
/** "Fri" for a YYYY-MM-DD calendar date (no time zone involved). */
export const fmtWeekdayOfDate = (date: string) => weekdayOfDate.format(new Date(`${date}T00:00:00Z`));

export function daysSince(v: string | null): number | null {
  if (!v) return null;
  return Math.floor((Date.now() - new Date(v).getTime()) / DAY_MS);
}

export function lastSeen(v: string | null): string {
  const d = daysSince(v);
  if (d === null) return "Never";
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  return `${d} days ago`;
}

/** INV-000123 */
export const invoiceNo = (n: number) => `INV-${String(n).padStart(6, "0")}`;
