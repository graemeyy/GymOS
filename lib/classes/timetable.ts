import type { Db } from "@/lib/db";
import { localDateIn, zonedTimeToUtc } from "@/lib/dates";
import { DAY_MS } from "@/lib/time";

// The next `days` calendar dates (starting today) in the gym's timezone, with
// weekday 0 = Monday. Steps by calendar date, not by 24 hours, so a
// daylight-saving change can't skip or repeat a day.
export function upcomingDates(tz: string, days: number, now = new Date()): { date: string; weekday: number }[] {
  const [y, m, d] = localDateIn(tz, now).split("-").map(Number);
  const out: { date: string; weekday: number }[] = [];
  for (let i = 0; i < days; i++) {
    const day = new Date(Date.UTC(y, m - 1, d + i));
    const date = day.toISOString().slice(0, 10);
    out.push({ date, weekday: (day.getUTCDay() + 6) % 7 });
  }
  return out;
}

// Creates dated classes from active weekly templates for the next few weeks.
// Safe to run every day: a template gets at most one class per local date, so
// a class staff cancelled (kept as a cancelled row) isn't recreated, and
// editing a template's time doesn't add a second class on days already
// generated (R-05, R-32).
export async function generateClasses(db: Db, tz: string, weeks = 2, now = new Date()) {
  const templates = await db.classTemplate.findMany({ where: { active: true }, include: { trainer: { select: { name: true } } } });
  if (templates.length === 0) return { created: 0 };
  const dates = upcomingDates(tz, weeks * 7, now);
  const existing = await db.class.findMany({
    where: { templateId: { in: templates.map((t) => t.id) }, startTime: { gte: new Date(now.getTime() - DAY_MS), lt: new Date(now.getTime() + (weeks * 7 + 1) * DAY_MS) } },
    select: { templateId: true, startTime: true },
  });
  const taken = new Set(existing.map((c) => `${c.templateId}|${localDateIn(tz, c.startTime)}`));
  let created = 0;
  for (const { date, weekday } of dates) {
    for (const t of templates.filter((x) => x.weekday === weekday)) {
      if (taken.has(`${t.id}|${date}`)) continue;
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
