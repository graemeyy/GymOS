import type { Prisma } from "@prisma/client";
import type { Db } from "@/lib/db";

export function audienceWhere(a: { audience: "ALL_ACTIVE" | "PLAN" | "STAFF_ONLY"; planId: string | null; locationId?: string | null }): Prisma.MemberWhereInput | null {
  if (a.audience === "STAFF_ONLY") return null;
  return {
    archivedAt: null,
    status: { in: ["ACTIVE", "PAST_DUE", "PAUSED"] },
    ...(a.audience === "PLAN" && a.planId ? { planId: a.planId } : {}),
    ...(a.locationId ? { homeLocationId: a.locationId } : {}),
  };
}

// For one location: its own announcements plus those for every location.
export function listAnnouncements(db: Db, locationIds: readonly string[] | null = null) {
  return db.announcement.findMany({
    where: locationIds ? { OR: [{ locationId: null }, { locationId: { in: [...locationIds] } }] } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { plan: { select: { name: true } }, createdBy: { select: { name: true } }, location: { select: { id: true, name: true } } },
  });
}

// Live announcements for one member's audience.
export async function listAnnouncementsForMember(db: Db, memberId: string, now = new Date()) {
  const me = await db.member.findUniqueOrThrow({ where: { id: memberId }, select: { planId: true, status: true, homeLocationId: true } });
  // The same audience as announcement emails: current members only, so
  // someone who signed up without paying, or has left, can't read
  // members-only notices such as a door code (R-44).
  if (me.status !== "ACTIVE" && me.status !== "PAST_DUE" && me.status !== "PAUSED") return [];
  return db.announcement.findMany({
    where: {
      publishedAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      AND: [{ OR: [{ audience: "ALL_ACTIVE" }, { audience: "PLAN", planId: me.planId ?? "__none__" }] }, { OR: [{ locationId: null }, { locationId: me.homeLocationId }] }],
    },
    orderBy: { publishedAt: "desc" },
    take: 10,
    select: { id: true, title: true, body: true, publishedAt: true },
  });
}
