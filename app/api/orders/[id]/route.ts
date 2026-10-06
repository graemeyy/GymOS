import { staffRoute, json } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { OrderStatusBody } from "@/lib/shop/schema";
import { getOrder } from "@/lib/shop/queries";
import { changeOrderStatus } from "@/lib/shop/service";
import { allowedTransitions } from "@/lib/shop/orders";
import { assertLocation } from "@/lib/locations/scope";

export const GET = staffRoute({ permission: "orders.manage" }, async ({ params, db, staff }) => {
  const order = await getOrder(db, params.id);
  if (!order) throw new ApiError("not_found", "Order not found.");
  assertLocation(staff, order.locationId);
  const { stripeCheckoutSessionId, ...rest } = order;
  return json({ ...rest, paidOnline: Boolean(stripeCheckoutSessionId), nextStatuses: allowedTransitions(order.status, order.fulfilment) });
});

export const PATCH = staffRoute({ permission: "orders.manage", body: OrderStatusBody }, async ({ params, body, db, staff }) => json(await changeOrderStatus(db, staff, params.id, body)));
