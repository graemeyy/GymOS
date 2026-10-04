import { memberRoute, json } from "@/lib/http/route";

export const GET = memberRoute({}, async ({ db, member }) => {
  const payments = await db.payment.findMany({
    where: { memberId: member.id },
    orderBy: { paidAt: "desc" },
    take: 50,
    select: { id: true, invoiceNumber: true, amount: true, gstCents: true, refundedCents: true, currency: true, status: true, description: true, kind: true, paidAt: true },
  });
  return json(payments);
});
