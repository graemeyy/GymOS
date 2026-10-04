import { staffRoute, json } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { OrderStatusBody } from "@/lib/shop/schema";
import { getOrder } from "@/lib/shop/queries";
import { changeOrderStatus } from "@/lib/shop/service";
import { allowedTransitions } from "@/lib/shop/orders";

export const GET = staffRoute({ permission: "orders:fulfil" }, async ({ params, db }) => {
  const order = await getOrder(db, params.id);
  if (!order) throw new ApiError("not_found", "Order not found.");
  const { stripeCheckoutSessionId, ...rest } = order;
  return json({ ...rest, paidOnline: Boolean(stripeCheckoutSessionId), nextStatuses: allowedTransitions(order.status, order.fulfilment) });
});

export const PATCH = staffRoute({ permission: "orders:fulfil", body: OrderStatusBody }, async ({ params, body, db, staff }) => json(await changeOrderStatus(db, staff, params.id, body)));
