// Fixed lengths of time in milliseconds. For calendar arithmetic (a day, a
// month) in the gym's time zone use lib/dates.ts instead: with daylight saving
// a local day can be 23 or 25 hours long.
export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;
