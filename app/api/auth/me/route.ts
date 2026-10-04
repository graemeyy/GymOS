import { publicRoute, json } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { resolveMember, resolveStaff } from "@/lib/auth/session";

// Who's signed in. For staff, the role and its permissions, so the console
// can show or lock controls; the server checks again on every request.
export const GET = publicRoute({}, async ({ request, db }) => {
  const staff = await resolveStaff(request, db);
  if (staff) return json({ kind: "staff", id: staff.id, name: staff.name, roleId: staff.roleId, roleName: staff.roleName, isOwner: staff.isOwner, permissions: staff.permissions });
  const member = await resolveMember(request, db);
  if (member) return json({ kind: "member", id: member.id, name: member.name, email: member.email });
  throw new ApiError("unauthenticated", "Not signed in.");
});
