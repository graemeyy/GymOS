import type { z } from "zod";
import type { Db, Tx } from "@/lib/db";
import type { StaffActor } from "@/lib/auth/session";
import { ApiError } from "@/lib/http/errors";
import { logAction } from "@/lib/audit";
import type { InventoryBody } from "./schema";

type InventoryInput = z.infer<typeof InventoryBody>;

async function assertSkuFree(tx: Tx, sku: string | null, exceptId?: string) {
  if (!sku) return;
  const clash = await tx.inventoryItem.findUnique({ where: { sku }, select: { id: true } });
  if (clash && clash.id !== exceptId) throw new ApiError("conflict", "An item with that SKU already exists.", { sku: "Already in use" });
}

export function createInventoryItem(db: Db, staff: StaffActor, input: InventoryInput) {
  const sku = input.sku || null;
  return db.$transaction(async (tx) => {
    await assertSkuFree(tx, sku);
    const item = await tx.inventoryItem.create({ data: { ...input, sku, category: input.category || null } });
    await logAction(tx, staff, { action: "inventory.created", targetType: "InventoryItem", targetId: item.id, details: { name: item.name, quantity: item.quantity } });
    return item;
  });
}

export function updateInventoryItem(db: Db, staff: StaffActor, id: string, input: InventoryInput) {
  const sku = input.sku || null;
  return db.$transaction(async (tx) => {
    await assertSkuFree(tx, sku, id);
    const item = await tx.inventoryItem.update({ where: { id }, data: { ...input, sku, category: input.category || null } });
    await logAction(tx, staff, { action: "inventory.updated", targetType: "InventoryItem", targetId: item.id, details: { name: item.name, quantity: item.quantity } });
    return item;
  });
}

// Stock adjustments are a front-desk action. The quantity condition makes
// the check and the write one atomic statement, so stock can't go negative.
export function adjustStock(db: Db, staff: StaffActor, id: string, delta: number) {
  return db.$transaction(async (tx) => {
    const result = await tx.inventoryItem.updateMany({
      where: { id, quantity: { gte: delta < 0 ? -delta : 0 } },
      data: { quantity: { increment: delta } },
    });
    if (result.count === 0) {
      const exists = await tx.inventoryItem.findUnique({ where: { id }, select: { id: true } });
      throw exists ? new ApiError("conflict", "Not enough stock on hand.") : new ApiError("not_found", "Item not found.");
    }
    const item = await tx.inventoryItem.findUniqueOrThrow({ where: { id } });
    await logAction(tx, staff, { action: "inventory.adjusted", targetType: "InventoryItem", targetId: id, details: { name: item.name, delta, quantity: item.quantity } });
    return item;
  });
}

export function deleteInventoryItem(db: Db, staff: StaffActor, id: string) {
  return db.$transaction(async (tx) => {
    const existing = await tx.inventoryItem.findUnique({ where: { id } });
    if (!existing) throw new ApiError("not_found", "Item not found.");
    await tx.inventoryItem.delete({ where: { id } });
    await logAction(tx, staff, { action: "inventory.deleted", targetType: "InventoryItem", targetId: id, details: { name: existing.name, quantity: existing.quantity } });
  });
}
