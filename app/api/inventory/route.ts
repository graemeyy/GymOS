import { SEE_STOCK_AND_EQUIPMENT } from "@/lib/auth/permissions";
import { staffRoute, json } from "@/lib/http/route";
import { InventoryBody } from "@/lib/inventory/schema";
import { listInventory } from "@/lib/inventory/queries";
import { createInventoryItem } from "@/lib/inventory/service";

export const GET = staffRoute({ permission: SEE_STOCK_AND_EQUIPMENT }, async ({ db }) => json(await listInventory(db)));

export const POST = staffRoute({ permission: "products.edit", body: InventoryBody }, async ({ body, db, staff }) => json(await createInventoryItem(db, staff, body), 201));
