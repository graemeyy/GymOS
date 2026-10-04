import { staffRoute, json } from "@/lib/http/route";
import { InventoryBody } from "@/lib/inventory/schema";
import { listInventory } from "@/lib/inventory/queries";
import { createInventoryItem } from "@/lib/inventory/service";

export const GET = staffRoute({ permission: "inventory:read" }, async ({ db }) => json(await listInventory(db)));

export const POST = staffRoute({ permission: "inventory:manage", body: InventoryBody }, async ({ body, db, staff }) => json(await createInventoryItem(db, staff, body), 201));
