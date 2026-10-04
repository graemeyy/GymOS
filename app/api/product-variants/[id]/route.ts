import { z } from "zod";
import { staffRoute, json } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { logAction } from "@/lib/audit";

const Body = z.object({ delta: z.number().int().min(-10_000).max(10_000).refine((d) => d !== 0, "Must not be zero"), reason: z.string().trim().max(200).optional() });

// Stock count adjustments (deliveries, stocktake corrections, damaged goods).
export const PATCH = staffRoute({ permission: "inventory:adjust", body: Body }, async ({ params, body, db, staff }) => {
  const result = await db.productVariant.updateMany({
    where: { id: params.id, stockQty: { gte: body.delta < 0 ? -body.delta : 0 } },
    data: { stockQty: { increment: body.delta } },
  });
  if (result.count === 0) {
    const exists = await db.productVariant.findUnique({ where: { id: params.id }, select: { id: true } });
    throw exists ? new ApiError("conflict", "That would take stock below zero.") : new ApiError("not_found", "Variant not found.");
  }
  const variant = await db.productVariant.findUniqueOrThrow({ where: { id: params.id }, include: { product: { select: { name: true } } } });
  await logAction(db, staff, { action: "stock.adjusted", targetType: "ProductVariant", targetId: params.id, details: { product: variant.product.name, sku: variant.sku, delta: body.delta, stock: variant.stockQty, reason: body.reason ?? null } });
  return json(variant);
});
