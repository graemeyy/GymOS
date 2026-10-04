import { staffRoute, json } from "@/lib/http/route";
import { MemberRef } from "@/lib/classes/schema";
import { joinWaitlist, leaveWaitlist } from "@/lib/classes/service";

export const POST = staffRoute({ permission: "bookings.manage", body: MemberRef }, async ({ params, body, db, staff }) => {
  return json(await joinWaitlist(db, staff, params.id, body.memberId), 201);
});

export const DELETE = staffRoute({ permission: "bookings.manage", query: MemberRef }, async ({ params, query, db, staff }) => {
  await leaveWaitlist(db, staff, params.id, query.memberId);
  return json({ ok: true });
});
