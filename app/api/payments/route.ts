import { staffRoute, json } from "@/lib/http/route";
import { PaymentListQuery } from "@/lib/billing/payments";
import { listPayments } from "@/lib/billing/queries";
import { locationWhere } from "@/lib/locations/scope";

// One location's payments, or every location the person's role covers (D-129).
export const GET = staffRoute({ permission: "finance.view", query: PaymentListQuery }, async ({ query, db, staff }) => json(await listPayments(db, query, locationWhere(staff, query.locationId))));
