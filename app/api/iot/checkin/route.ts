import { z } from "zod";
import { publicRoute, json, zId } from "@/lib/http/route";
import { assertBearer } from "@/lib/http/bearer";
import { env } from "@/lib/env";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { checkInMember } from "@/lib/checkin/service";

const Body = z.object({ memberId: zId, gatewayId: z.string().trim().max(64).optional() });

// Door gateway. Authenticated with IOT_GATEWAY_SECRET; refuses everything if
// that isn't set. Returns only what a door display needs.
export const POST = publicRoute({ rateLimit: RATE_LIMITS.iot }, async ({ request, db }) => {
  assertBearer(request, env().IOT_GATEWAY_SECRET, "The door gateway");
  const raw = await request.json().catch(() => null);
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return json({ granted: false, reason: "Bad request" }, 400);
  const location = parsed.data.gatewayId || "Main entrance";
  const exists = await db.member.findUnique({ where: { id: parsed.data.memberId }, select: { id: true } });
  if (!exists) return json({ granted: false, reason: "Unknown card" });
  const { member, decision } = await checkInMember(db, { kind: "system", name: `Gateway ${location}` }, exists.id, location);
  return decision.granted
    ? json({ granted: true, displayName: member.name?.split(" ")[0] ?? "Member" })
    : json({ granted: false, reason: decision.reason });
});
