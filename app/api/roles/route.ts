import { staffRoute, json } from "@/lib/http/route";
import { CreateRoleBody } from "@/lib/roles/schema";
import { listRoles } from "@/lib/roles/queries";
import { createRole } from "@/lib/roles/service";

// Any staff member can see what each role allows; changing roles needs roles.manage.
export const GET = staffRoute({ permission: null }, async ({ db }) => json(await listRoles(db)));

export const POST = staffRoute({ permission: "roles.manage", body: CreateRoleBody }, async ({ body, db, staff }) => json(await createRole(db, staff, body), 201));
