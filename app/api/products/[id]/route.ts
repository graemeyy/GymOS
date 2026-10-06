import { z } from "zod";
import { staffRoute, json } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { ProductBody } from "@/lib/shop/schema";
import { getProduct } from "@/lib/shop/queries";
import { archiveProduct, updateProduct } from "@/lib/shop/service";
import { withClaimWarnings } from "@/lib/shop/products";
import { withStock } from "@/lib/shop/stock";
import { assertLocation } from "@/lib/locations/scope";

const Query = z.object({ locationId: z.string().min(1).max(40).optional() });

export const GET = staffRoute({ permission: "orders.manage", query: Query }, async ({ params, db, staff, query }) => {
  const product = await getProduct(db, params.id);
  if (!product) throw new ApiError("not_found", "Product not found.");
  if (query.locationId) assertLocation(staff, query.locationId);
  const [withCounts] = await withStock(db, [product], query.locationId ?? null, staff.locationIds);
  return json(withClaimWarnings(withCounts));
});

export const PUT = staffRoute({ permission: "products.edit", body: ProductBody }, async ({ params, body, db, staff }) => {
  const [product] = await withStock(db, [await updateProduct(db, staff, params.id, body)], body.stockLocationId ?? null, staff.locationIds);
  return json(withClaimWarnings(product));
});

export const DELETE = staffRoute({ permission: "products.edit" }, async ({ params, db, staff }) => {
  await archiveProduct(db, staff, params.id);
  return json({ ok: true });
});
