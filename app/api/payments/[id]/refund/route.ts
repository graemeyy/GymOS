import { z } from "zod";
import { staffRoute, json, zCents } from "@/lib/http/route";
import { refundPayment } from "@/lib/billing/refunds";

const Body = z.object({
  amountCents: zCents,
  reason: z.string().trim().min(3, "Say why").max(300),
  method: z.enum(["STRIPE", "MANUAL"]),
});

export const POST = staffRoute({ permission: "billing:refund", body: Body }, async ({ params, body, db, staff }) => {
  return json(await refundPayment(db, staff, { paymentId: params.id, ...body }), 201);
});
