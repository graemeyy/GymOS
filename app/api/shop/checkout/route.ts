import { memberRoute, json } from "@/lib/http/route";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { ShopCheckoutBody, startShopCheckout } from "@/lib/shop/checkout";

// Members check out their cart. Prices, discount, shipping and GST are worked
// out here from the database; the browser only says what and how many.
export const POST = memberRoute({ body: ShopCheckoutBody, rateLimit: RATE_LIMITS.checkout }, async ({ body, db, member }) => {
  return json(await startShopCheckout(db, member, body), 201);
});
