import { staffRoute, json } from "@/lib/http/route";
import { ProductBody, ProductListQuery } from "@/lib/shop/schema";
import { listProducts } from "@/lib/shop/queries";
import { createProduct } from "@/lib/shop/service";
import { withClaimWarnings } from "@/lib/shop/products";

export const GET = staffRoute({ permission: "orders:fulfil", query: ProductListQuery }, async ({ query, db }) => json(await listProducts(db, query)));

export const POST = staffRoute({ permission: "shop:manage", body: ProductBody }, async ({ body, db, staff }) => json(withClaimWarnings(await createProduct(db, staff, body)), 201));
