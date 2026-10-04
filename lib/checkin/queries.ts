import type { Db } from "@/lib/db";

export function listRecentCheckIns(db: Db) {
  return db.checkIn.findMany({
    take: 15,
    orderBy: { timestamp: "desc" },
    select: { id: true, location: true, method: true, timestamp: true, member: { select: { id: true, name: true, status: true } } },
  });
}
