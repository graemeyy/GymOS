import { SEE_STOCK_AND_EQUIPMENT } from "@/lib/auth/permissions";
import { staffRoute, json } from "@/lib/http/route";
import { EquipmentBody } from "@/lib/equipment/schema";
import { listEquipment } from "@/lib/equipment/queries";
import { createEquipment } from "@/lib/equipment/service";

export const GET = staffRoute({ permission: SEE_STOCK_AND_EQUIPMENT }, async ({ db }) => json(await listEquipment(db)));

export const POST = staffRoute({ permission: "products.edit", body: EquipmentBody }, async ({ body, db, staff }) => json(await createEquipment(db, staff, body), 201));
