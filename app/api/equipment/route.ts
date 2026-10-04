import { staffRoute, json } from "@/lib/http/route";
import { EquipmentBody } from "@/lib/equipment/schema";
import { listEquipment } from "@/lib/equipment/queries";
import { createEquipment } from "@/lib/equipment/service";

export const GET = staffRoute({ permission: "equipment:read" }, async ({ db }) => json(await listEquipment(db)));

export const POST = staffRoute({ permission: "equipment:manage", body: EquipmentBody }, async ({ body, db, staff }) => json(await createEquipment(db, staff, body), 201));
