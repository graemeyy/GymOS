import { z } from "zod";
import { staffRoute, json } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { logAction } from "@/lib/audit";
import { claimWarnings, PRODUCT_CATEGORIES, ProductBody, slugify } from "@/lib/shop/products";

const Query = z.object({ category: z.enum(PRODUCT_CATEGORIES).optional(), includeArchived: z.enum(["1", "0"]).default("0") });

export const GET = staffRoute({ permission: "orders:fulfil", query: Query }, async ({ query, db }) => {
  const products = await db.product.findMany({
    where: { ...(query.category ? { category: query.category } : {}), ...(query.includeArchived === "1" ? {} : { active: true }) },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    include: { variants: { orderBy: [{ size: "asc" }, { colour: "asc" }, { flavour: "asc" }] } },
  });
  return json(products);
});

export const POST = staffRoute({ permission: "shop:manage", body: ProductBody }, async ({ body, db, staff }) => {
  const base = slugify(body.name);
  if (!base) throw new ApiError("validation_failed", "Use a name with letters or numbers.", { name: "Invalid" });
  let slug = base;
  for (let i = 2; await db.product.findUnique({ where: { slug } }); i++) slug = `${base}-${i}`;
  const skus = body.variants.map((v) => v.sku);
  if (new Set(skus).size !== skus.length) throw new ApiError("validation_failed", "Each variant needs its own SKU.", { variants: "Duplicate SKU" });
  const clash = await db.productVariant.findFirst({ where: { sku: { in: skus } }, select: { sku: true } });
  if (clash) throw new ApiError("conflict", `SKU ${clash.sku} is already used by another product.`, { variants: "SKU in use" });

  const { variants, ...fields } = body;
  const product = await db.product.create({
    data: {
      ...fields,
      description: fields.description ?? null,
      imageUrl: fields.imageUrl ?? null,
      slug,
      variants: { create: variants.map(({ id: _id, ...v }) => ({ ...v, size: v.size || null, colour: v.colour || null, flavour: v.flavour || null })) },
    },
    include: { variants: true },
  });
  await logAction(db, staff, { action: "product.created", targetType: "Product", targetId: product.id, details: { name: product.name, variants: variants.length } });
  return json({ ...product, claimWarnings: product.category === "SUPPLEMENTS" ? claimWarnings(product.description) : [] }, 201);
});
