import { staffRoute, json } from "@/lib/http/route";
import { PaymentListQuery } from "@/lib/billing/payments";
import { listPayments } from "@/lib/billing/queries";

export const GET = staffRoute({ permission: "finance.view", query: PaymentListQuery }, async ({ query, db }) => json(await listPayments(db, query)));
