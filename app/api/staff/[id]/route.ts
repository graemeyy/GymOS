import { staffRoute, json } from "@/lib/http/route";
import { UpdateStaffBody } from "@/lib/staff/schema";
import { deleteStaff, updateStaff } from "@/lib/staff/service";

export const PUT = staffRoute({ permission: "staff:manage", body: UpdateStaffBody }, async ({ params, body, db, staff }) => json(await updateStaff(db, staff, params.id, body)));

export const DELETE = staffRoute({ permission: "staff:manage" }, async ({ params, db, staff }) => {
  await deleteStaff(db, staff, params.id);
  return json({ ok: true });
});
