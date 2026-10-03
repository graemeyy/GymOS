import { z } from "zod";
import { staffRoute, json, zId } from "@/lib/http/route";
import { joinWaitlist, leaveWaitlist } from "@/lib/classes/service";

const MemberBody = z.object({ memberId: zId });

export const POST = staffRoute({ permission: "classes:book", body: MemberBody }, async ({ params, body, db, staff }) => {
  return json(await joinWaitlist(db, staff, params.id, body.memberId), 201);
});

export const DELETE = staffRoute({ permission: "classes:book", query: MemberBody }, async ({ params, query, db, staff }) => {
  await leaveWaitlist(db, staff, params.id, query.memberId);
  return json({ ok: true });
});
