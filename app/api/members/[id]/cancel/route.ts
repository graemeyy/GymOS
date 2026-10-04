import { z } from "zod";
import { staffRoute, json } from "@/lib/http/route";
import { requestCancellation, withdrawCancellation } from "@/lib/membership/service";

const Body = z.object({ reason: z.string().trim().max(300).optional(), immediate: z.boolean().default(false) });

// Follows the owner's cancellation rules (notice, cooling-off, minimum term).
// "immediate" overrides them, for cases such as a consumer guarantee remedy.
export const POST = staffRoute({ permission: "billing:manage", body: Body }, async ({ params, body, db, staff }) => {
  const terms = await requestCancellation(db, staff, params.id, body);
  return json(terms);
});

export const DELETE = staffRoute({ permission: "billing:manage" }, async ({ params, db, staff }) => {
  await withdrawCancellation(db, staff, params.id);
  return json({ ok: true });
});
