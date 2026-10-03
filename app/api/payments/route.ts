import { z } from "zod";
import { staffRoute, json } from "@/lib/http/route";

const Query = z.object({ take: z.coerce.number().int().min(1).max(500).default(50) });

export const GET = staffRoute({ permission: "revenue:view", query: Query }, async ({ query, db }) => {
  const payments = await db.payment.findMany({
    orderBy: { createdAt: "desc" },
    take: query.take,
    select: {
      id: true,
      amount: true,
      gstCents: true,
      currency: true,
      status: true,
      description: true,
      createdAt: true,
      member: { select: { id: true, name: true, email: true, membershipPlan: { select: { name: true } } } },
    },
  });
  return json(payments);
});
