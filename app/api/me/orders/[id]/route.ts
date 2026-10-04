import { memberRoute, json } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { gym } from "@/lib/config";

// One of the member's own orders. Another member's order answers "not found".
// Staff notes on status changes are internal, so only statuses and times are
// shown, plus the tracking number.
export const GET = memberRoute({}, async ({ params, db, member }) => {
  const order = await db.order.findFirst({
    where: { id: params.id, memberId: member.id },
    select: {
      id: true,
      number: true,
      status: true,
      fulfilment: true,
      subtotalCents: true,
      discountCents: true,
      discountPercent: true,
      shippingCents: true,
      totalCents: true,
      gstCents: true,
      shippingAddress: true,
      trackingNumber: true,
      createdAt: true,
      paidAt: true,
      items: { select: { id: true, productName: true, variantLabel: true, quantity: true, unitPriceCents: true, lineTotalCents: true } },
      events: { orderBy: { createdAt: "asc" }, select: { status: true, createdAt: true } },
      payment: { select: { id: true, invoiceNumber: true, refundedCents: true } },
    },
  });
  if (!order) throw new ApiError("not_found", "Order not found.");
  return json({ ...order, pickupAddress: gym.business.address, changeOfMindReturnsDays: gym.policies.shop.changeOfMindReturnsDays });
});
