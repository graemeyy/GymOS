import { z } from "zod";
import { staffRoute, json, zId } from "@/lib/http/route";
import { promoteFromWaitlist } from "@/lib/classes/service";

export const POST = staffRoute({ permission: "classes:book", body: z.object({ memberId: zId }) }, async ({ params, body, db, staff }) => {
  return json(await promoteFromWaitlist(db, staff, params.id, body.memberId), 201);
});
