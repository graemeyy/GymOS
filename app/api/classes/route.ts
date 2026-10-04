import { z } from "zod";
import { staffRoute, json, zName } from "@/lib/http/route";
import { logAction } from "@/lib/audit";

export const GET = staffRoute({ permission: "classes:read" }, async ({ db }) => {
  const classes = await db.class.findMany({
    // 24h lookback so a class that just ended stays visible for attendance.
    where: { startTime: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    orderBy: { startTime: "asc" },
    include: {
      bookings: { include: { member: { select: { id: true, name: true, email: true } } } },
      waitlist: { orderBy: { createdAt: "asc" }, include: { member: { select: { id: true, name: true, email: true } } } },
    },
  });
  return json(classes);
});

const Body = z.object({
  name: zName,
  instructor: z.string().trim().max(120).nullable().optional(),
  startTime: z.coerce.date(),
  durationMinutes: z.number().int().min(10).max(240).default(45),
  capacity: z.number().int().min(1).max(500).default(20),
});

export const POST = staffRoute({ permission: "classes:manage", body: Body }, async ({ body, db, staff }) => {
  const cls = await db.class.create({ data: { ...body, instructor: body.instructor || null } });
  await logAction(db, staff, { action: "class.created", targetType: "Class", targetId: cls.id, details: { name: cls.name, startTime: cls.startTime.toISOString() } });
  return json(cls, 201);
});
