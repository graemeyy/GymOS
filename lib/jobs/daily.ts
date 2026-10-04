import type { Db } from "@/lib/db";
import { DAY_MS } from "@/lib/time";
import { gym } from "@/lib/config";
import { applyDueTransitions } from "@/lib/membership/service";
import { sendPaymentReminders } from "@/lib/billing/reminders";
import { generateClasses } from "@/lib/classes/timetable";
import { retentionScore } from "@/lib/retention";
import { anonymiseMember } from "@/lib/members/account";

async function updateRetentionScores(db: Db, now: Date) {
  const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS);
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
  const checkInCutoff = monthsAgo(r.checkInHistoryMonths);
  const checkIns = await db.checkIn.deleteMany({ where: { timestamp: { lt: checkInCutoff } } });
  // Each visit is also in the audit log; it goes on the same schedule (R-46).
  await db.auditLog.deleteMany({ where: { action: "member.checked_in", createdAt: { lt: checkInCutoff } } });
  const due = await db.member.findMany({ where: { archivedAt: { lt: monthsAgo(r.archivedMemberMonths) }, anonymisedAt: null }, select: { id: true }, take: 200 });
  for (const m of due) await anonymiseMember(db, { kind: "system", name: "Data retention" }, m.id);
  return { checkInsDeleted: checkIns.count, membersAnonymised: due.length };
}

// Runs each step on its own: a failure is logged (by step name only) and the
// remaining steps still run, so one bad record can't stop reminders or the
// timetable for the day (R-35).
export async function runSteps<T extends Record<string, () => Promise<unknown>>>(steps: T): Promise<{ [K in keyof T]?: Awaited<ReturnType<T[K]>> } & { failed: string[] }> {
  const results: Record<string, unknown> = {};
  const failed: string[] = [];
  for (const [name, step] of Object.entries(steps)) {
    try {
      results[name] = await step();
    } catch (error) {
      failed.push(name);
      console.error(`Daily job step "${name}" failed:`, error instanceof Error ? error.name : "unknown");
    }
  }
  return { ...results, failed } as { [K in keyof T]?: Awaited<ReturnType<T[K]>> } & { failed: string[] };
}

// Everything that runs once a day (Vercel cron): membership transitions,
// payment reminders, the class timetable, retention scores, data retention
// and clean-up of expired rate-limit counters. Each step is idempotent.
export async function runDailyJobs(db: Db, now = new Date()) {
  const r = await runSteps({
    transitions: () => applyDueTransitions(db, now),
    reminders: () => sendPaymentReminders(db, now),
    timetable: () => generateClasses(db, gym.business.timezone, 2, now),
    retentionScores: () => updateRetentionScores(db, now),
    dataRetention: () => applyDataRetention(db, now),
    rateLimits: async () => (await db.rateLimit.deleteMany({ where: { windowStart: { lt: new Date(now.getTime() - DAY_MS) } } })).count,
  });
  return {
    ...r.transitions,
    ...r.reminders,
    classesCreated: r.timetable?.created,
    retentionUpdated: r.retentionScores,
    ...r.dataRetention,
    rateLimitRowsCleaned: r.rateLimits,
    failed: r.failed,
  };
}
