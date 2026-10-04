import { z } from "zod";
import { publicRoute, json, readBodyText, zId } from "@/lib/http/route";
import { assertBearer } from "@/lib/http/bearer";
import { env } from "@/lib/env";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { checkInAtGateway } from "@/lib/checkin/service";

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const Body = z.object({ memberId: zId, gatewayId: z.string().trim().max(64).optional() });

// Door gateway. Authenticated with IOT_GATEWAY_SECRET; refuses everything if
// that isn't set. Returns only what a door display needs.
export const POST = publicRoute({ rateLimit: RATE_LIMITS.iot }, async ({ request, db }) => {
  assertBearer(request, env().IOT_GATEWAY_SECRET, "The door gateway");
  // A door gateway sends a few dozen bytes; refuse anything larger unread (R-79).
  const text = await readBodyText(request, 4 * 1024);
  const parsed = Body.safeParse(safeJson(text));
  if (!parsed.success) return json({ granted: false, reason: "Bad request" }, 400);
  const result = await checkInAtGateway(db, parsed.data.memberId, parsed.data.gatewayId || "Main entrance");
  if (!result) return json({ granted: false, reason: "Unknown card" });
  const { member, decision } = result;
  return decision.granted
    ? json({ granted: true, displayName: member.name?.split(" ")[0] ?? "Member" })
    : json({ granted: false, reason: decision.reason });
});
