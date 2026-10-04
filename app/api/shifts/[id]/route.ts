import { staffRoute, json } from "@/lib/http/route";
import { deleteShift } from "@/lib/shifts/service";

export const DELETE = staffRoute({ permission: "shifts:manage" }, async ({ params, db, staff }) => {
  await deleteShift(db, staff, params.id);
  return json({ ok: true });
});
