import { memberRoute, json } from "@/lib/http/route";

export const GET = memberRoute({}, async ({ db, member }) => {
  const payments = await db.payment.findMany({
    where: { memberId: member.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, amount: true, gstCents: true, currency: true, status: true, description: true, createdAt: true },
  });
  return json(payments);
});
