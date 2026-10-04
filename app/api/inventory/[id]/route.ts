import { staffRoute, json } from "@/lib/http/route";
import { AdjustStockBody, InventoryBody } from "@/lib/inventory/schema";
import { adjustStock, deleteInventoryItem, updateInventoryItem } from "@/lib/inventory/service";

// Adjusting stock is a front-desk action; editing or removing the item is a manager's.
export const PATCH = staffRoute({ permission: "orders.manage", body: AdjustStockBody }, async ({ params, body, db, staff }) => json(await adjustStock(db, staff, params.id, body.delta)));

export const PUT = staffRoute({ permission: "products.edit", body: InventoryBody }, async ({ params, body, db, staff }) => json(await updateInventoryItem(db, staff, params.id, body)));

export const DELETE = staffRoute({ permission: "products.edit" }, async ({ params, db, staff }) => {
  await deleteInventoryItem(db, staff, params.id);
  return json({ ok: true });
});
