import type { Prisma } from "@prisma/client";
import type { Db } from "@/lib/db";

export function listRecentCheckIns(db: Db, where: Prisma.CheckInWhereInput = {}) {
  return db.checkIn.findMany({
    where,
    take: 15,
    orderBy: { timestamp: "desc" },
    select: { id: true, location: true, method: true, timestamp: true, site: { select: { id: true, name: true } }, member: { select: { id: true, name: true, status: true } } },
  });
}
