import type { Db } from "@/lib/db";
import { zonedTimeToUtc } from "@/lib/dates";

// Dates of the next `days` days (starting today) in the gym's timezone, with
// weekday 0 = Monday.
export function upcomingDates(tz: string, days: number, now = new Date()): { date: string; weekday: number }[] {
  const out: { date: string; weekday: number }[] = [];
  for (let i = 0; i < days; i++) {
    const instant = new Date(now.getTime() + i * 86_400_000);
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
    const short = new Intl.DateTimeFormat("en-AU", { timeZone: tz, weekday: "short" }).format(instant);
    const weekday = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(short.slice(0, 3));
    out.push({ date, weekday });
  }
  return out;
}

// Creates dated classes from active weekly templates for the next few weeks.
// Safe to run repeatedly: (template, start time) is unique, so a slot that
// already exists is skipped, and a class staff cancelled isn't recreated
// unless it's run again.
export async function generateClasses(db: Db, tz: string, weeks = 2, now = new Date()) {
  const templates = await db.classTemplate.findMany({ where: { active: true }, include: { trainer: { select: { name: true } } } });
  let created = 0;
  for (const { date, weekday } of upcomingDates(tz, weeks * 7, now)) {
    for (const t of templates.filter((x) => x.weekday === weekday)) {
      const startTime = zonedTimeToUtc(date, t.startTime, tz);
      if (startTime <= now) continue;
      const result = await db.class.createMany({
        data: [{ name: t.name, templateId: t.id, trainerId: t.trainerId, instructor: t.trainer?.name ?? null, startTime, durationMinutes: t.durationMinutes, capacity: t.capacity }],
        skipDuplicates: true,
      });
      created += result.count;
    }
  }
  return { created };
}
