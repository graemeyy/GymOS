import { staffRoute, json } from "@/lib/http/route";
import { InventoryBody } from "@/lib/inventory/schema";
import { ApiError } from "@/lib/http/errors";
import { logAction } from "@/lib/audit";

export const GET = staffRoute({ permission: "inventory:read" }, async ({ db }) => {
  return json(await db.inventoryItem.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] }));
});

export const POST = staffRoute({ permission: "inventory:manage", body: InventoryBody }, async ({ body, db, staff }) => {
  const sku = body.sku || null;
  if (sku && (await db.inventoryItem.findUnique({ where: { sku } }))) {
    throw new ApiError("conflict", "An item with that SKU already exists.", { sku: "Already in use" });
  }
  const item = await db.inventoryItem.create({ data: { ...body, sku, category: body.category || null } });
  await logAction(db, staff, { action: "inventory.created", targetType: "InventoryItem", targetId: item.id, details: { name: item.name, quantity: item.quantity } });
  return json(item, 201);
});
