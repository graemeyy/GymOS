import { z } from "zod";
import { staffRoute, json, zId } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { logAction } from "@/lib/audit";

export const GET = staffRoute({ permission: "shifts:read" }, async ({ db }) => {
  const shifts = await db.shift.findMany({
    where: { startTime: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
    orderBy: { startTime: "asc" },
    include: { staff: { select: { id: true, name: true, role: true } } },
  });
  return json(shifts);
});

const Body = z
  .object({ staffId: zId, startTime: z.coerce.date(), endTime: z.coerce.date(), notes: z.string().trim().max(500).nullable().optional() })
  .refine((b) => b.endTime > b.startTime, { message: "End time must be after start time", path: ["endTime"] })
  .refine((b) => b.endTime.getTime() - b.startTime.getTime() <= 16 * 60 * 60 * 1000, { message: "A shift can't be longer than 16 hours", path: ["endTime"] });

export const POST = staffRoute({ permission: "shifts:manage", body: Body }, async ({ body, db, staff }) => {
  const member = await db.staff.findUnique({ where: { id: body.staffId }, select: { name: true } });
  if (!member) throw new ApiError("not_found", "Staff member not found.");
  const shift = await db.shift.create({
    data: { ...body, notes: body.notes || null },
    include: { staff: { select: { id: true, name: true, role: true } } },
  });
  await logAction(db, staff, { action: "shift.created", targetType: "Shift", targetId: shift.id, details: { staffName: member.name, startTime: body.startTime.toISOString() } });
  return json(shift, 201);
});
