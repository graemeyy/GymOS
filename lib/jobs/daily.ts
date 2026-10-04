import type { Db } from "@/lib/db";
import { gym } from "@/lib/config";
import { applyDueTransitions } from "@/lib/membership/service";
import { sendPaymentReminders } from "@/lib/billing/reminders";
import { generateClasses } from "@/lib/classes/timetable";
import { retentionScore } from "@/lib/retention";

async function updateRetentionScores(db: Db, now: Date) {
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);
  const members = await db.member.findMany({
    where: { archivedAt: null },
    select: {
      id: true,
      lastCheckIn: true,
      _count: {
        select: {
          checkIns: { where: { timestamp: { gte: thirtyDaysAgo } } },
          classBookings: { where: { status: "NO_SHOW", class: { startTime: { gte: thirtyDaysAgo } } } },
        },
      },
    },
  });
  const updates = members.map((m) =>
    db.member.update({
      where: { id: m.id },
      data: { retentionScore: retentionScore({ lastCheckIn: m.lastCheckIn, visitsLast30Days: m._count.checkIns, noShowsLast30Days: m._count.classBookings }, now) },
    })
  );
  for (let i = 0; i < updates.length; i += 100) await db.$transaction(updates.slice(i, i + 100));
  return updates.length;
}

// Everything that runs once a day (Vercel cron): membership transitions,
// payment reminders, the class timetable, retention scores, and clean-up of
// expired rate-limit counters. Each step is independent and idempotent.
export async function runDailyJobs(db: Db, now = new Date()) {
  const transitions = await applyDueTransitions(db, now);
  const reminders = await sendPaymentReminders(db, now);
  const timetable = await generateClasses(db, gym.business.timezone, 2, now);
  const retentionUpdated = await updateRetentionScores(db, now);
  const cleaned = await db.rateLimit.deleteMany({ where: { windowStart: { lt: new Date(now.getTime() - 86_400_000) } } });
  return { ...transitions, ...reminders, classesCreated: timetable.created, retentionUpdated, rateLimitRowsCleaned: cleaned.count };
}
