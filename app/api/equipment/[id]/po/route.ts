import { staffRoute, json } from "@/lib/http/route";
import { draftPurchaseOrder } from "@/lib/equipment/service";

export const POST = staffRoute({ permission: "products.edit" }, async ({ params, db, staff }) => {
  const { action, isNew } = await draftPurchaseOrder(db, staff, params.id);
  if (!isNew) return json({ message: "A purchase order is already waiting for approval.", action });
  return json({ message: "Purchase order drafted.", action }, 201);
});
