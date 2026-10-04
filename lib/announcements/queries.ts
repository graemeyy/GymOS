import type { Prisma } from "@prisma/client";
import type { Db } from "@/lib/db";

export function audienceWhere(a: { audience: "ALL_ACTIVE" | "PLAN" | "STAFF_ONLY"; planId: string | null }): Prisma.MemberWhereInput | null {
  if (a.audience === "STAFF_ONLY") return null;
  return {
    archivedAt: null,
    status: { in: ["ACTIVE", "PAST_DUE", "PAUSED"] },
    ...(a.audience === "PLAN" && a.planId ? { planId: a.planId } : {}),
  };
}

export function isLive(a: { publishedAt: Date | null; expiresAt: Date | null }, now = new Date()) {
  return Boolean(a.publishedAt && a.publishedAt <= now && (!a.expiresAt || a.expiresAt > now));
}

export function listAnnouncements(db: Db) {
  return db.announcement.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { plan: { select: { name: true } }, createdBy: { select: { name: true } } } });
}

// Live announcements for one member's audience.
export async function listAnnouncementsForMember(db: Db, memberId: string, now = new Date()) {
  const me = await db.member.findUniqueOrThrow({ where: { id: memberId }, select: { planId: true, status: true } });
  // The same audience as announcement emails: current members only, so
  // someone who signed up without paying, or has left, can't read
  // members-only notices such as a door code (R-44).
  if (me.status !== "ACTIVE" && me.status !== "PAST_DUE" && me.status !== "PAUSED") return [];
  return db.announcement.findMany({
    where: {
      publishedAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      AND: [{ OR: [{ audience: "ALL_ACTIVE" }, { audience: "PLAN", planId: me.planId ?? "__none__" }] }],
    },
    orderBy: { publishedAt: "desc" },
    take: 10,
    select: { id: true, title: true, body: true, publishedAt: true },
  });
}
