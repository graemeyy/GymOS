import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { staffRoute, json, zName, zId } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { logAction } from "@/lib/audit";

const Query = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  mine: z.enum(["1", "0"]).default("0"),
});

const memberSelect = { select: { id: true, name: true, email: true } } as const;

export const GET = staffRoute({ permission: "classes:read", query: Query }, async ({ query, db, staff }) => {
  // Default: from 24h ago (so finished classes can still have attendance
  // marked) to 14 days ahead.
  const from = query.from ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
  const to = query.to ?? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  if (to.getTime() - from.getTime() > 62 * 86_400_000) throw new ApiError("validation_failed", "Choose a range of two months or less.");
  const where: Prisma.ClassWhereInput = { startTime: { gte: from, lt: to }, cancelledAt: null, ...(query.mine === "1" ? { trainerId: staff.id } : {}) };
  const classes = await db.class.findMany({
    where,
    orderBy: { startTime: "asc" },
    include: {
      trainer: { select: { id: true, name: true } },
      bookings: { include: { member: memberSelect } },
      waitlist: { orderBy: { createdAt: "asc" }, include: { member: memberSelect } },
    },
  });
  return json(classes);
});

const Body = z.object({
  name: zName,
  trainerId: zId.nullable().optional(),
  startTime: z.coerce.date(),
  durationMinutes: z.number().int().min(10).max(240).default(45),
  capacity: z.number().int().min(1).max(500).default(20),
});

export const POST = staffRoute({ permission: "classes:manage", body: Body }, async ({ body, db, staff }) => {
  const trainer = body.trainerId ? await db.staff.findUnique({ where: { id: body.trainerId }, select: { id: true, name: true } }) : null;
  if (body.trainerId && !trainer) throw new ApiError("validation_failed", "That trainer doesn't exist.", { trainerId: "Not found" });
  const cls = await db.class.create({ data: { ...body, trainerId: trainer?.id ?? null, instructor: trainer?.name ?? null } });
  await logAction(db, staff, { action: "class.created", targetType: "Class", targetId: cls.id, details: { name: cls.name, startTime: cls.startTime.toISOString(), trainer: trainer?.name ?? null } });
  return json(cls, 201);
});
