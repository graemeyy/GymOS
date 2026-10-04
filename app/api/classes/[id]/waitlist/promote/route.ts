import { staffRoute, json } from "@/lib/http/route";
import { MemberRef } from "@/lib/classes/schema";
import { promoteFromWaitlist } from "@/lib/classes/service";

export const POST = staffRoute({ permission: "classes:book", body: MemberRef }, async ({ params, body, db, staff }) => {
  return json(await promoteFromWaitlist(db, staff, params.id, body.memberId), 201);
});
