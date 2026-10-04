import { gym } from "@/lib/config/client";

// Browser-side date formatting in the gym's timezone, so staff in another
// zone still see gym-local times.
const tz = gym.business.timezone;

export const fmtDate = (v: string | Date) => new Intl.DateTimeFormat("en-AU", { timeZone: tz, day: "numeric", month: "short", year: "numeric" }).format(new Date(v));
export const fmtDateTime = (v: string | Date) =>
  new Intl.DateTimeFormat("en-AU", { timeZone: tz, weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(v));
export const fmtTime = (v: string | Date) => new Intl.DateTimeFormat("en-AU", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(new Date(v));

export function daysSince(v: string | null): number | null {
  if (!v) return null;
  return Math.floor((Date.now() - new Date(v).getTime()) / 86_400_000);
}

export function lastSeen(v: string | null): string {
  const d = daysSince(v);
  if (d === null) return "Never";
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  return `${d} days ago`;
}

export const invoiceNo = (n: number) => `INV-${String(n).padStart(6, "0")}`;
