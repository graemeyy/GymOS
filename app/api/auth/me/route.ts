import { publicRoute, json } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { hideRevenueFromFrontDesk, resolveMember, resolveStaff } from "@/lib/auth/session";
import { permissionsFor } from "@/lib/auth/permissions";

export const GET = publicRoute({}, async ({ request, db }) => {
  const staff = await resolveStaff(request, db);
  if (staff) {
    const permissions = permissionsFor(staff.role, { hideRevenueFromFrontDesk: await hideRevenueFromFrontDesk(db) });
    return json({ kind: "staff", id: staff.id, name: staff.name, role: staff.role, permissions });
  }
  const member = await resolveMember(request, db);
  if (member) return json({ kind: "member", id: member.id, name: member.name, email: member.email });
  throw new ApiError("unauthenticated", "Not signed in.");
});
