import { publicRoute, json } from "@/lib/http/route";
import { assertBearer } from "@/lib/http/bearer";
import { env } from "@/lib/env";
import { retentionScore } from "@/lib/retention";

// Nightly retention scoring, called by Vercel cron with CRON_SECRET.
export const GET = publicRoute({}, async ({ request, db }) => {
  assertBearer(request, env().CRON_SECRET, "The cron job");
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
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
  const now = new Date();
  const updates = members.map((m) =>
    db.member.update({
      where: { id: m.id },
      data: { retentionScore: retentionScore({ lastCheckIn: m.lastCheckIn, visitsLast30Days: m._count.checkIns, noShowsLast30Days: m._count.classBookings }, now) },
    })
  );
  for (let i = 0; i < updates.length; i += 100) await db.$transaction(updates.slice(i, i + 100));
  return json({ ok: true, updated: updates.length });
});
