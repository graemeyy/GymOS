import { z } from "zod";
import { staffRoute, json, zName, zCents } from "@/lib/http/route";
import { logAction } from "@/lib/audit";

export const GET = staffRoute({ permission: "equipment:read" }, async ({ db }) => {
  return json(await db.equipment.findMany({ orderBy: { createdAt: "desc" } }));
});

const Body = z.object({
  name: zName,
  serialNumber: z.string().trim().max(64).nullable().optional(),
  status: z.enum(["OPERATIONAL", "WARNING", "OFFLINE"]).default("OPERATIONAL"),
  lastServicedAt: z.coerce.date().nullable().optional(),
  partNeeded: z.string().trim().max(200).nullable().optional(),
  estimatedCost: zCents.nullable().optional(),
});

export const POST = staffRoute({ permission: "equipment:manage", body: Body }, async ({ body, db, staff }) => {
  const equipment = await db.equipment.create({ data: { ...body, serialNumber: body.serialNumber || null } });
  await logAction(db, staff, { action: "equipment.created", targetType: "Equipment", targetId: equipment.id, details: { name: equipment.name } });
  return json(equipment, 201);
});
