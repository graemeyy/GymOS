import type { Db } from "@/lib/db";

// Shifts that haven't ended, so one in progress stays on the roster (R-85).
export function listUpcomingShifts(db: Db) {
  return db.shift.findMany({
    where: { endTime: { gte: new Date() } },
    orderBy: { startTime: "asc" },
    include: { staff: { select: { id: true, name: true, role: true } } },
  });
}
