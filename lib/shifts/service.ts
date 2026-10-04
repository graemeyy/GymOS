import type { Db } from "@/lib/db";
import type { StaffActor } from "@/lib/auth/session";
import { ApiError } from "@/lib/http/errors";
import { logAction } from "@/lib/audit";
import type { ShiftInput } from "./schema";

export function createShift(db: Db, staff: StaffActor, input: ShiftInput) {
  return db.$transaction(async (tx) => {
    const rostered = await tx.staff.findUnique({ where: { id: input.staffId }, select: { name: true } });
    if (!rostered) throw new ApiError("not_found", "Staff member not found.");
    const shift = await tx.shift.create({
      data: { ...input, notes: input.notes || null },
      include: { staff: { select: { id: true, name: true, role: true } } },
    });
    await logAction(tx, staff, { action: "shift.created", targetType: "Shift", targetId: shift.id, details: { staffName: rostered.name, startTime: input.startTime.toISOString() } });
    return shift;
  });
}

export function deleteShift(db: Db, staff: StaffActor, id: string) {
  return db.$transaction(async (tx) => {
    const shift = await tx.shift.findUnique({ where: { id }, include: { staff: { select: { name: true } } } });
    if (!shift) throw new ApiError("not_found", "Shift not found.");
    await tx.shift.delete({ where: { id } });
    await logAction(tx, staff, { action: "shift.deleted", targetType: "Shift", targetId: id, details: { staffName: shift.staff.name, startTime: shift.startTime.toISOString() } });
  });
}
