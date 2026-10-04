import { memberRoute, json } from "@/lib/http/route";
import { joinWaitlistAsMember, leaveWaitlist } from "@/lib/classes/service";

export const POST = memberRoute({}, async ({ params, db, member }) => {
  await joinWaitlistAsMember(db, member, params.id);
  return json({ ok: true }, 201);
});

export const DELETE = memberRoute({}, async ({ params, db, member }) => {
  await leaveWaitlist(db, member, params.id, member.id);
  return json({ ok: true });
});
