import { memberRoute, json } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { joinWaitlist, leaveWaitlist } from "@/lib/classes/service";

export const POST = memberRoute({}, async ({ params, db, member }) => {
  const me = await db.member.findUniqueOrThrow({ where: { id: member.id }, select: { status: true } });
  if (me.status !== "ACTIVE") throw new ApiError("conflict", "Your membership needs to be active to join a waitlist.");
  await joinWaitlist(db, member, params.id, member.id);
  return json({ ok: true }, 201);
});

export const DELETE = memberRoute({}, async ({ params, db, member }) => {
  await leaveWaitlist(db, member, params.id, member.id);
  return json({ ok: true });
});
