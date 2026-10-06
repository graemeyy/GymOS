import { staffRoute, json } from "@/lib/http/route";
import { ProductBody, ProductListQuery } from "@/lib/shop/schema";
import { listProducts } from "@/lib/shop/queries";
import { createProduct } from "@/lib/shop/service";
import { withClaimWarnings } from "@/lib/shop/products";
import { withStock } from "@/lib/shop/stock";
import { assertLocation } from "@/lib/locations/scope";

// Stock is shown at the location asked for, or totalled over the locations
// the person can see (D-127).
export const GET = staffRoute({ permission: "orders.manage", query: ProductListQuery }, async ({ query, db, staff }) => {
  if (query.locationId) assertLocation(staff, query.locationId);
  return json(await withStock(db, await listProducts(db, query), query.locationId ?? null, staff.locationIds));
});

export const POST = staffRoute({ permission: "products.edit", body: ProductBody }, async ({ body, db, staff }) => {
  const [product] = await withStock(db, [await createProduct(db, staff, body)], body.stockLocationId ?? null, staff.locationIds);
  return json(withClaimWarnings(product), 201);
});
