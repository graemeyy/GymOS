import type { Db } from "@/lib/db";

export function listRecentCheckIns(db: Db) {
  return db.checkIn.findMany({
    take: 15,
    orderBy: { timestamp: "desc" },
    select: { id: true, location: true, method: true, timestamp: true, member: { select: { id: true, name: true, status: true } } },
  });
}

// The front desk's fallback when a pass won't scan: find the member by name
// (or the start of their email) and check them in by ID. Erased members
// never show; archived ones do, so staff can see why they're refused.
export function searchForCheckIn(db: Db, query: string) {
  const q = query.trim();
  return db.member.findMany({
    where: { anonymisedAt: null, OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { startsWith: q.toLowerCase() } }] },
    orderBy: [{ name: "asc" }, { createdAt: "asc" }],
    take: 8,
    select: { id: true, name: true, status: true, archivedAt: true, membershipPlan: { select: { name: true } } },
  });
}
