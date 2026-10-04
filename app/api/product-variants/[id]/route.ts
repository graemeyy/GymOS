import { staffRoute, json } from "@/lib/http/route";
import { StockAdjustBody } from "@/lib/shop/schema";
import { adjustVariantStock } from "@/lib/shop/service";

export const PATCH = staffRoute({ permission: "inventory:adjust", body: StockAdjustBody }, async ({ params, body, db, staff }) => json(await adjustVariantStock(db, staff, params.id, body.delta, body.reason)));
