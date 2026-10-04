import { memberRoute, json } from "@/lib/http/route";

// Live announcements for the signed-in member's audience.
export const GET = memberRoute({}, async ({ db, member }) => {
  const now = new Date();
  const me = await db.member.findUniqueOrThrow({ where: { id: member.id }, select: { planId: true, status: true } });
  // The same audience as announcement emails: current members only, so
  // someone who signed up without paying, or has left, can't read
  // members-only notices such as a door code (R-44).
  if (me.status !== "ACTIVE" && me.status !== "PAST_DUE" && me.status !== "PAUSED") return json([]);
  const rows = await db.announcement.findMany({
    where: {
      publishedAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      AND: [{ OR: [{ audience: "ALL_ACTIVE" }, { audience: "PLAN", planId: me.planId ?? "__none__" }] }],
    },
    orderBy: { publishedAt: "desc" },
    take: 10,
    select: { id: true, title: true, body: true, publishedAt: true },
  });
  return json(rows);
});
