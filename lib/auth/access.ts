import type { Db, Tx } from "@/lib/db";
import { ApiError } from "@/lib/http/errors";
import { can } from "./permissions";
import type { StaffActor } from "./session";

// Access that depends on the record as well as the permission. A trainer
// without a permission still runs their own classes and sees the members
// booked into them, and nothing else (R-33).

/** Mark attendance: anyone with bookings.manage, or the class's own trainer. */
export async function assertCanMarkAttendance(db: Db | Tx, staff: StaffActor, classId: string) {
  if (can(staff, "bookings.manage")) return;
  const cls = await db.class.findUnique({ where: { id: classId }, select: { trainerId: true } });
  if (!cls) throw new ApiError("not_found", "Class not found.");
  if (cls.trainerId !== staff.id) throw new ApiError("forbidden", "You can only mark attendance for your own classes.");
}

export { ownClassesOnly } from "./permissions";
