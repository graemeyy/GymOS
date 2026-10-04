// Dates are stored in UTC and shown in the gym's timezone (from config).

function partsIn(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

// Offset in minutes between the zone and UTC at a given instant.
function offsetMinutes(date: Date, timeZone: string): number {
  const p = partsIn(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - date.getTime()) / 60000);
}

// Midnight today in the given timezone, as a UTC Date.
export function startOfTodayIn(timeZone: string, now = new Date()): Date {
  const p = partsIn(now, timeZone);
  const guess = new Date(Date.UTC(p.year, p.month - 1, p.day));
  return new Date(guess.getTime() - offsetMinutes(guess, timeZone) * 60000);
}

// Converts a wall-clock date and time in a zone (as typed into a form) to UTC.
export function zonedTimeToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const first = new Date(guess.getTime() - offsetMinutes(guess, timeZone) * 60000);
  // Re-check once in case the guess crossed a daylight-saving boundary.
  return new Date(guess.getTime() - offsetMinutes(first, timeZone) * 60000);
}

export function formatDate(value: Date | string, timeZone: string) {
  return new Intl.DateTimeFormat("en-AU", { timeZone, day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

export function formatDateTime(value: Date | string, timeZone: string) {
  return new Intl.DateTimeFormat("en-AU", { timeZone, weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export function formatTime(value: Date | string, timeZone: string) {
  return new Intl.DateTimeFormat("en-AU", { timeZone, hour: "numeric", minute: "2-digit" }).format(new Date(value));
}
