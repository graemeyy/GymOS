import type { Db } from "@/lib/db";

export function listInventory(db: Db) {
  return db.inventoryItem.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] });
}
