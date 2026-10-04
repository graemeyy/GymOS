import { z } from "zod";
import { memberRoute, json } from "@/lib/http/route";
import { requestCancellation, withdrawCancellation } from "@/lib/membership/service";

// Members can't choose "immediate"; the owner's cooling-off, notice and
// minimum term rules decide the date.
const Body = z.object({ reason: z.string().trim().max(300).optional() });

export const POST = memberRoute({ body: Body }, async ({ body, db, member }) => {
  return json(await requestCancellation(db, member, member.id, { reason: body.reason }));
});

export const DELETE = memberRoute({}, async ({ db, member }) => {
  await withdrawCancellation(db, member, member.id);
  return json({ ok: true });
});
