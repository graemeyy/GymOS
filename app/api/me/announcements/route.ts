import { memberRoute, json } from "@/lib/http/route";

// Live announcements for the signed-in member's audience.
export const GET = memberRoute({}, async ({ db, member }) => {
  const now = new Date();
  const me = await db.member.findUniqueOrThrow({ where: { id: member.id }, select: { planId: true } });
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
