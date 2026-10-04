import { memberRoute, json } from "@/lib/http/route";

// The member's own orders. Abandoned checkouts are left out.
export const GET = memberRoute({}, async ({ db, member }) => {
  const orders = await db.order.findMany({
    where: { memberId: member.id, NOT: { status: "CANCELLED", paidAt: null } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, number: true, status: true, fulfilment: true, totalCents: true, createdAt: true, _count: { select: { items: true } } },
  });
  return json(orders);
});
