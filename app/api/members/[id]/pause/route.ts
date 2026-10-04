import { z } from "zod";
import { staffRoute, json } from "@/lib/http/route";
import { pauseMembership, resumeMembership } from "@/lib/membership/service";

const Body = z.object({ from: z.coerce.date(), until: z.coerce.date() }).refine((b) => b.until > b.from, { message: "End must be after start", path: ["until"] });

export const POST = staffRoute({ permission: "billing:manage", body: Body }, async ({ params, body, db, staff }) => {
  await pauseMembership(db, staff, params.id, body.from, body.until);
  return json({ ok: true });
});

export const DELETE = staffRoute({ permission: "billing:manage" }, async ({ params, db, staff }) => {
  await resumeMembership(db, staff, params.id);
  return json({ ok: true });
});
