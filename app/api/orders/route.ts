import { z } from "zod";
import { staffRoute, json } from "@/lib/http/route";

const Query = z.object({
  status: z.enum(["PENDING_PAYMENT", "PAID", "PACKED", "READY_FOR_PICKUP", "SHIPPED", "COMPLETED", "CANCELLED", "REFUNDED"]).optional(),
  open: z.enum(["1", "0"]).default("0"),
  take: z.coerce.number().int().min(1).max(200).default(100),
});

export const GET = staffRoute({ permission: "orders:fulfil", query: Query }, async ({ query, db }) => {
  const orders = await db.order.findMany({
    where: query.status ? { status: query.status } : query.open === "1" ? { status: { in: ["PAID", "PACKED", "READY_FOR_PICKUP"] } } : {},
    orderBy: { createdAt: "desc" },
    take: query.take,
    select: {
      id: true,
      number: true,
      status: true,
      fulfilment: true,
      customerName: true,
      email: true,
      totalCents: true,
      createdAt: true,
      paidAt: true,
      _count: { select: { items: true } },
    },
  });
  return json(orders);
});
