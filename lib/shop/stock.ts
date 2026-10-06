import type { Db, Tx } from "@/lib/db";

// Shop stock is counted per location (D-127). Orders take stock from their
// pickup (or shipping) location; the stock page counts each location.

/** Units of each variant at a location; missing rows are zero. */
export async function stockAt(db: Db | Tx, variantIds: string[], locationId: string): Promise<Map<string, number>> {
  const rows = await db.variantStock.findMany({ where: { variantId: { in: variantIds }, locationId }, select: { variantId: true, quantity: true } });
  return new Map(variantIds.map((id) => [id, rows.find((r) => r.variantId === id)?.quantity ?? 0]));
}

/** Units of each variant at every location, and the total. */
export async function stockByLocation(db: Db | Tx, variantIds: string[]): Promise<Map<string, { total: number; byLocation: Record<string, number> }>> {
  const rows = await db.variantStock.findMany({ where: { variantId: { in: variantIds } }, select: { variantId: true, locationId: true, quantity: true } });
  const result = new Map(variantIds.map((id) => [id, { total: 0, byLocation: {} as Record<string, number> }]));
  for (const r of rows) {
    const entry = result.get(r.variantId)!;
    entry.byLocation[r.locationId] = r.quantity;
    entry.total += r.quantity;
  }
  return result;
}

// Takes units in one statement that also checks there are enough, so two
// orders can't both take the last one. Returns false if there weren't.
export async function takeStock(tx: Tx, variantId: string, locationId: string, quantity: number): Promise<boolean> {
  const res = await tx.variantStock.updateMany({ where: { variantId, locationId, quantity: { gte: quantity } }, data: { quantity: { decrement: quantity } } });
  return res.count === 1;
}

export async function addStock(tx: Tx, variantId: string, locationId: string, quantity: number): Promise<number> {
  const row = await tx.variantStock.upsert({
    where: { variantId_locationId: { variantId, locationId } },
    create: { variantId, locationId, quantity },
    update: { quantity: { increment: quantity } },
    select: { quantity: true },
  });
  return row.quantity;
}

// Staff views of products show each variant's stock at one location, or the
// total across the locations the person can see, plus the split by location.
export async function withStock<P extends { variants: { id: string }[] }>(db: Db | Tx, products: P[], locationId: string | null, visible: readonly string[] | null) {
  const counts = await stockByLocation(db, products.flatMap((p) => p.variants.map((v) => v.id)));
  return products.map((p) => ({
    ...p,
    variants: p.variants.map((v) => {
      const c = counts.get(v.id)!;
      const byLocation = visible ? Object.fromEntries(Object.entries(c.byLocation).filter(([id]) => visible.includes(id))) : c.byLocation;
      const stockQty = locationId ? (c.byLocation[locationId] ?? 0) : Object.values(byLocation).reduce((a, b) => a + b, 0);
      return { ...v, stockQty, stockByLocation: byLocation };
    }),
  }));
}
