import { z } from "zod";
import { staffRoute, json } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { logAction } from "@/lib/audit";
import { InventoryBody } from "@/lib/inventory/schema";

const AdjustBody = z.object({ delta: z.number().int().min(-10_000).max(10_000).refine((d) => d !== 0, "Must not be zero") });

// Stock adjustments are a front-desk action; editing the item is a manager's.
export const PATCH = staffRoute({ permission: "inventory:adjust", body: AdjustBody }, async ({ params, body, db, staff }) => {
  // The quantity condition makes check-and-write one atomic statement.
  const result = await db.inventoryItem.updateMany({
    where: { id: params.id, quantity: { gte: body.delta < 0 ? -body.delta : 0 } },
    data: { quantity: { increment: body.delta } },
  });
  if (result.count === 0) {
    const exists = await db.inventoryItem.findUnique({ where: { id: params.id }, select: { id: true } });
    throw exists ? new ApiError("conflict", "Not enough stock on hand.") : new ApiError("not_found", "Item not found.");
  }
  const item = await db.inventoryItem.findUniqueOrThrow({ where: { id: params.id } });
  await logAction(db, staff, { action: "inventory.adjusted", targetType: "InventoryItem", targetId: params.id, details: { name: item.name, delta: body.delta, quantity: item.quantity } });
  return json(item);
});

export const PUT = staffRoute({ permission: "inventory:manage", body: InventoryBody }, async ({ params, body, db, staff }) => {
  const sku = body.sku || null;
  if (sku) {
    const clash = await db.inventoryItem.findUnique({ where: { sku } });
    if (clash && clash.id !== params.id) throw new ApiError("conflict", "An item with that SKU already exists.", { sku: "Already in use" });
  }
  const item = await db.inventoryItem.update({ where: { id: params.id }, data: { ...body, sku, category: body.category || null } });
  await logAction(db, staff, { action: "inventory.updated", targetType: "InventoryItem", targetId: item.id, details: { name: item.name, quantity: item.quantity } });
  return json(item);
});

export const DELETE = staffRoute({ permission: "inventory:manage" }, async ({ params, db, staff }) => {
  const existing = await db.inventoryItem.findUnique({ where: { id: params.id } });
  if (!existing) throw new ApiError("not_found", "Item not found.");
  await db.inventoryItem.delete({ where: { id: params.id } });
  await logAction(db, staff, { action: "inventory.deleted", targetType: "InventoryItem", targetId: params.id, details: { name: existing.name, quantity: existing.quantity } });
  return json({ ok: true });
});
