import type { Db } from "@/lib/db";
import { gym } from "@/lib/config";
import { applyDueTransitions } from "@/lib/membership/service";
import { sendPaymentReminders } from "@/lib/billing/reminders";
import { generateClasses } from "@/lib/classes/timetable";
import { retentionScore } from "@/lib/retention";
import { anonymiseMember } from "@/lib/members/account";

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
// Applies the retention periods in config (and promised in the privacy
// policy): old check-ins are deleted, and members archived for longer than
// the gym keeps personal details are anonymised. Payment records stay.
export async function applyDataRetention(db: Db, now = new Date()) {
  const r = gym.policies.dataRetention;
  const monthsAgo = (months: number) => {
    const d = new Date(now);
    d.setMonth(d.getMonth() - months);
    return d;
  };
  const checkIns = await db.checkIn.deleteMany({ where: { timestamp: { lt: monthsAgo(r.checkInHistoryMonths) } } });
  const due = await db.member.findMany({ where: { archivedAt: { lt: monthsAgo(r.archivedMemberMonths) }, anonymisedAt: null }, select: { id: true }, take: 200 });
  for (const m of due) await anonymiseMember(db, { kind: "system", name: "Data retention" }, m.id);
  return { checkInsDeleted: checkIns.count, membersAnonymised: due.length };
}

export async function runDailyJobs(db: Db, now = new Date()) {
  const transitions = await applyDueTransitions(db, now);
  const reminders = await sendPaymentReminders(db, now);
  const timetable = await generateClasses(db, gym.business.timezone, 2, now);
  const retentionUpdated = await updateRetentionScores(db, now);
  const retention = await applyDataRetention(db, now);
  const cleaned = await db.rateLimit.deleteMany({ where: { windowStart: { lt: new Date(now.getTime() - 86_400_000) } } });
  return { ...transitions, ...reminders, classesCreated: timetable.created, retentionUpdated, ...retention, rateLimitRowsCleaned: cleaned.count };
}
