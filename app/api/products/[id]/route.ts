import { staffRoute, json } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { ProductBody } from "@/lib/shop/schema";
import { getProduct } from "@/lib/shop/queries";
import { archiveProduct, updateProduct } from "@/lib/shop/service";
import { withClaimWarnings } from "@/lib/shop/products";

export const GET = staffRoute({ permission: "orders.manage" }, async ({ params, db }) => {
  const product = await getProduct(db, params.id);
  if (!product) throw new ApiError("not_found", "Product not found.");
  return json(withClaimWarnings(product));
});

export const PUT = staffRoute({ permission: "products.edit", body: ProductBody }, async ({ params, body, db, staff }) => json(withClaimWarnings(await updateProduct(db, staff, params.id, body))));

export const DELETE = staffRoute({ permission: "products.edit" }, async ({ params, db, staff }) => {
  await archiveProduct(db, staff, params.id);
  return json({ ok: true });
});
