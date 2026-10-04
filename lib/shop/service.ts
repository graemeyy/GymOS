import type { Db, Tx } from "@/lib/db";
import type { StaffActor } from "@/lib/auth/session";
import { ApiError } from "@/lib/http/errors";
import { logAction } from "@/lib/audit";
import { slugify } from "./products";
import { updateOrderStatus } from "./orders";
import { sendOrderEmail } from "./emails";
import type { OrderStatusInput, ProductInput } from "./schema";

function assertDistinctSkus(skus: string[]) {
  if (new Set(skus).size !== skus.length) throw new ApiError("validation_failed", "Each variant needs its own SKU.", { variants: "Duplicate SKU" });
}

async function assertSkusFree(tx: Tx, skus: string[], exceptProductId?: string) {
  const clash = await tx.productVariant.findFirst({ where: { sku: { in: skus }, ...(exceptProductId ? { productId: { not: exceptProductId } } : {}) }, select: { sku: true } });
  if (clash) throw new ApiError("conflict", `SKU ${clash.sku} is already used by another product.`, { variants: "SKU in use" });
}

const blankToNull = (v: { size?: string | null; colour?: string | null; flavour?: string | null }) => ({ size: v.size || null, colour: v.colour || null, flavour: v.flavour || null });

export function createProduct(db: Db, staff: StaffActor, input: ProductInput) {
  return db.$transaction(async (tx) => {
    const base = slugify(input.name);
    if (!base) throw new ApiError("validation_failed", "Use a name with letters or numbers.", { name: "Invalid" });
    let slug = base;
    for (let i = 2; await tx.product.findUnique({ where: { slug } }); i++) slug = `${base}-${i}`;
    const skus = input.variants.map((v) => v.sku);
    assertDistinctSkus(skus);
    await assertSkusFree(tx, skus);

    const { variants, ...fields } = input;
    const product = await tx.product.create({
      data: {
        ...fields,
        description: fields.description ?? null,
        imageUrl: fields.imageUrl ?? null,
        slug,
        variants: { create: variants.map(({ id: _id, ...v }) => ({ ...v, ...blankToNull(v) })) },
      },
      include: { variants: true },
    });
    await logAction(tx, staff, { action: "product.created", targetType: "Product", targetId: product.id, details: { name: product.name, variants: variants.length } });
    return product;
  });
}

// Variants in the input replace the product's variants: matched by id are
// updated, new ones created, missing ones deactivated (never deleted, because
// past orders refer to them).
export function updateProduct(db: Db, staff: StaffActor, id: string, input: ProductInput) {
  return db.$transaction(async (tx) => {
    const existing = await tx.product.findUnique({ where: { id }, include: { variants: true } });
    if (!existing) throw new ApiError("not_found", "Product not found.");
    const skus = input.variants.map((v) => v.sku);
    assertDistinctSkus(skus);
    const ownIds = new Set(existing.variants.map((v) => v.id));
    await assertSkusFree(tx, skus, id);

    const { variants, ...fields } = input;
    const keep = new Set(variants.filter((v) => v.id && ownIds.has(v.id)).map((v) => v.id!));
    await tx.product.update({ where: { id }, data: { ...fields, description: fields.description ?? null, imageUrl: fields.imageUrl ?? null } });
    await tx.productVariant.updateMany({ where: { productId: id, id: { notIn: [...keep] } }, data: { active: false } });
    for (const { id: variantId, stockQty, ...v } of variants) {
      const data = { ...v, ...blankToNull(v) };
      // Stock on an existing variant only changes through the stock
      // adjustment endpoint: this form's number may be stale, and writing it
      // would bring back units sold while the form was open (R-11).
      if (variantId && ownIds.has(variantId)) await tx.productVariant.update({ where: { id: variantId }, data });
      else await tx.productVariant.create({ data: { ...data, stockQty, productId: id } });
    }
    const product = await tx.product.findUniqueOrThrow({ where: { id }, include: { variants: true } });
    await logAction(tx, staff, { action: "product.updated", targetType: "Product", targetId: id, details: { name: product.name } });
    return product;
  });
}

// Archive, not delete: past orders keep their product.
export function archiveProduct(db: Db, staff: StaffActor, id: string) {
  return db.$transaction(async (tx) => {
    const product = await tx.product.update({ where: { id }, data: { active: false } });
    await logAction(tx, staff, { action: "product.archived", targetType: "Product", targetId: id, details: { name: product.name } });
  });
}

// Stock count adjustments (deliveries, stocktake corrections, damaged goods).
// The quantity condition makes the check and the write one atomic statement,
// so stock can't go negative.
export function adjustVariantStock(db: Db, staff: StaffActor, id: string, delta: number, reason: string | undefined) {
  return db.$transaction(async (tx) => {
    const result = await tx.productVariant.updateMany({
      where: { id, stockQty: { gte: delta < 0 ? -delta : 0 } },
      data: { stockQty: { increment: delta } },
    });
    if (result.count === 0) {
      const exists = await tx.productVariant.findUnique({ where: { id }, select: { id: true } });
      throw exists ? new ApiError("conflict", "That would take stock below zero.") : new ApiError("not_found", "Variant not found.");
    }
    const variant = await tx.productVariant.findUniqueOrThrow({ where: { id }, include: { product: { select: { name: true } } } });
    await logAction(tx, staff, { action: "stock.adjusted", targetType: "ProductVariant", targetId: id, details: { product: variant.product.name, sku: variant.sku, delta, stock: variant.stockQty, reason: reason ?? null } });
    return variant;
  });
}

export async function changeOrderStatus(db: Db, staff: StaffActor, id: string, input: OrderStatusInput) {
  const order = await updateOrderStatus(db, staff, id, input.status, { note: input.note, trackingNumber: input.trackingNumber });
  // Tell the customer when there's something for them to do or expect.
  if (input.status === "READY_FOR_PICKUP" || input.status === "SHIPPED") {
    await sendOrderEmail(db, order.id, input.status === "SHIPPED" ? "shipped" : "ready").catch(() => undefined);
  }
  return order;
}
