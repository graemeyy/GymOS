import { staffRoute, json } from "@/lib/http/route";
import { UpdateRoleBody } from "@/lib/roles/schema";
import { deleteRole, updateRole } from "@/lib/roles/service";

export const PUT = staffRoute({ permission: "roles.manage", body: UpdateRoleBody }, async ({ params, body, db, staff }) => json(await updateRole(db, staff, params.id, body)));

export const DELETE = staffRoute({ permission: "roles.manage" }, async ({ params, db, staff }) => {
  await deleteRole(db, staff, params.id);
  return json({ ok: true });
});
