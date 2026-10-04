import { staffRoute, json } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { logAction } from "@/lib/audit";
import { claimWarnings, ProductBody } from "@/lib/shop/products";

export const GET = staffRoute({ permission: "orders:fulfil" }, async ({ params, db }) => {
  const product = await db.product.findUnique({ where: { id: params.id }, include: { variants: { orderBy: [{ size: "asc" }, { colour: "asc" }] } } });
  if (!product) throw new ApiError("not_found", "Product not found.");
  return json({ ...product, claimWarnings: product.category === "SUPPLEMENTS" ? claimWarnings(product.description) : [] });
});

// Variants in the body replace the product's variants: matched by id are
// updated, new ones created, missing ones deactivated (never deleted, because
// past orders refer to them).
export const PUT = staffRoute({ permission: "shop:manage", body: ProductBody }, async ({ params, body, db, staff }) => {
  const existing = await db.product.findUnique({ where: { id: params.id }, include: { variants: true } });
  if (!existing) throw new ApiError("not_found", "Product not found.");
  const skus = body.variants.map((v) => v.sku);
  if (new Set(skus).size !== skus.length) throw new ApiError("validation_failed", "Each variant needs its own SKU.", { variants: "Duplicate SKU" });
  const ownIds = new Set(existing.variants.map((v) => v.id));
  const clash = await db.productVariant.findFirst({ where: { sku: { in: skus }, productId: { not: params.id } }, select: { sku: true } });
  if (clash) throw new ApiError("conflict", `SKU ${clash.sku} is already used by another product.`, { variants: "SKU in use" });

  const { variants, ...fields } = body;
  const keep = new Set(variants.filter((v) => v.id && ownIds.has(v.id)).map((v) => v.id!));
  const product = await db.$transaction(async (tx) => {
    await tx.product.update({ where: { id: params.id }, data: { ...fields, description: fields.description ?? null, imageUrl: fields.imageUrl ?? null } });
    await tx.productVariant.updateMany({ where: { productId: params.id, id: { notIn: [...keep] } }, data: { active: false } });
    for (const { id, stockQty, ...v } of variants) {
      const data = { ...v, size: v.size || null, colour: v.colour || null, flavour: v.flavour || null };
      // Stock on an existing variant only changes through the stock
      // adjustment endpoint: this form's number may be stale, and writing it
      // would bring back units sold while the form was open (R-11).
      if (id && ownIds.has(id)) await tx.productVariant.update({ where: { id }, data });
      else await tx.productVariant.create({ data: { ...data, stockQty, productId: params.id } });
    }
    return tx.product.findUniqueOrThrow({ where: { id: params.id }, include: { variants: true } });
  });
  await logAction(db, staff, { action: "product.updated", targetType: "Product", targetId: params.id, details: { name: product.name } });
  return json({ ...product, claimWarnings: product.category === "SUPPLEMENTS" ? claimWarnings(product.description) : [] });
});

// Archive, not delete: past orders keep their product.
export const DELETE = staffRoute({ permission: "shop:manage" }, async ({ params, db, staff }) => {
  const product = await db.product.update({ where: { id: params.id }, data: { active: false } });
  await logAction(db, staff, { action: "product.archived", targetType: "Product", targetId: params.id, details: { name: product.name } });
  return json({ ok: true });
});
