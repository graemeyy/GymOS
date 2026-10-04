import type { Db } from "@/lib/db";

// Shifts that haven't ended, so one in progress stays on the roster (R-85).
// Each shift carries its staff member's role name.
export async function listUpcomingShifts(db: Db) {
  const shifts = await db.shift.findMany({
    where: { endTime: { gte: new Date() } },
    orderBy: { startTime: "asc" },
    include: { staff: { select: { id: true, name: true, assignedRole: { select: { name: true } } } } },
  });
  return shifts.map(({ staff: { assignedRole, ...staff }, ...shift }) => ({ ...shift, staff: { ...staff, role: assignedRole?.name ?? "No role" } }));
}
