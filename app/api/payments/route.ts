import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { staffRoute, json } from "@/lib/http/route";

const Query = z.object({
  take: z.coerce.number().int().min(1).max(500).default(100),
  kind: z.enum(["MEMBERSHIP", "SHOP", "OTHER"]).optional(),
  status: z.enum(["succeeded", "refunded", "partially_refunded"]).optional(),
  q: z.string().trim().max(120).optional(),
});

export const GET = staffRoute({ permission: "revenue:view", query: Query }, async ({ query, db }) => {
  const where: Prisma.PaymentWhereInput = {
    ...(query.kind ? { kind: query.kind } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.q
      ? {
          OR: [
            { member: { name: { contains: query.q, mode: "insensitive" } } },
            { member: { email: { contains: query.q, mode: "insensitive" } } },
            ...(/^\d+$/.test(query.q.replace(/^INV-/i, "")) ? [{ invoiceNumber: Number(query.q.replace(/^INV-/i, "")) }] : []),
          ],
        }
      : {}),
  };
  const payments = await db.payment.findMany({
    where,
    orderBy: { paidAt: "desc" },
    take: query.take,
    select: {
      id: true,
      amount: true,
      gstCents: true,
      refundedCents: true,
      currency: true,
      status: true,
      kind: true,
      description: true,
      invoiceNumber: true,
      paidAt: true,
      member: { select: { id: true, name: true, email: true, membershipPlan: { select: { name: true } } } },
    },
  });
  return json(payments);
});
