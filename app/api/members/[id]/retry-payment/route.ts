import { staffRoute, json } from "@/lib/http/route";
import { retryFailedPayment } from "@/lib/membership/service";

export const POST = staffRoute({ permission: "billing:manage" }, async ({ params, db, staff }) => {
  const invoice = await retryFailedPayment(db, staff, params.id);
  return json({ status: invoice.status, paid: invoice.status === "paid" });
});
