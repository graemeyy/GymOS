import { staffRoute, json } from "@/lib/http/route";
import { reissuePass } from "@/lib/members/service";

// Reissues the member's QR pass (lost or shared phone). Old passes stop working.
export const POST = staffRoute({ permission: "members.edit" }, async ({ params, db, staff }) => {
  await reissuePass(db, staff, params.id);
  return json({ ok: true });
});
