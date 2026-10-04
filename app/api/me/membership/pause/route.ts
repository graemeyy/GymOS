import { z } from "zod";
import { memberRoute, json, zGymDate } from "@/lib/http/route";
import { pauseMembership, resumeMembership } from "@/lib/membership/service";

const Body = z.object({ from: zGymDate, until: zGymDate }).refine((b) => b.until > b.from, { message: "End must be after start", path: ["until"] });

// Pause rules (length, how often, whether members may pause themselves) are
// checked in the service, the same as for staff.
export const POST = memberRoute({ body: Body }, async ({ body, db, member }) => {
  await pauseMembership(db, member, member.id, body.from, body.until);
  return json({ ok: true });
});

export const DELETE = memberRoute({}, async ({ db, member }) => {
  await resumeMembership(db, member, member.id);
  return json({ ok: true });
});
