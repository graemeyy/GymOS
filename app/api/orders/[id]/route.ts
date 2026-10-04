import { z } from "zod";
import { staffRoute, json } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { allowedTransitions, updateOrderStatus } from "@/lib/shop/orders";

export const GET = staffRoute({ permission: "orders:fulfil" }, async ({ params, db }) => {
  const order = await db.order.findUnique({
    where: { id: params.id },
    include: {
      items: true,
      events: { orderBy: { createdAt: "asc" } },
      payment: { select: { id: true, amount: true, refundedCents: true, invoiceNumber: true } },
      member: { select: { id: true, name: true } },
    },
  });
  if (!order) throw new ApiError("not_found", "Order not found.");
  const { stripeCheckoutSessionId, ...rest } = order;
  return json({ ...rest, paidOnline: Boolean(stripeCheckoutSessionId), nextStatuses: allowedTransitions(order.status, order.fulfilment) });
});

const Body = z.object({
  status: z.enum(["PAID", "PACKED", "READY_FOR_PICKUP", "SHIPPED", "COMPLETED", "CANCELLED"]),
  note: z.string().trim().max(300).optional(),
  trackingNumber: z.string().trim().max(60).optional(),
});

export const PATCH = staffRoute({ permission: "orders:fulfil", body: Body }, async ({ params, body, db, staff }) => {
  return json(await updateOrderStatus(db, staff, params.id, body.status, { note: body.note, trackingNumber: body.trackingNumber }));
});
