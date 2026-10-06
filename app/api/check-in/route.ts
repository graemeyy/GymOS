import { z } from "zod";
import { staffRoute, json } from "@/lib/http/route";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { listRecentCheckIns } from "@/lib/checkin/queries";
import { checkInByQuery } from "@/lib/checkin/service";
import { LocationQuery } from "@/lib/locations/schema";
import { locationWhere } from "@/lib/locations/scope";

// Front-desk check-in. Staff only, so member details never reach the public
// (audit S2).
export const GET = staffRoute({ permission: "checkin.scan", query: LocationQuery }, async ({ db, staff, query }) => json(await listRecentCheckIns(db, locationWhere(staff, query.locationId))));

// The desk's location (D-125); the main location if there's only one.
const Body = z.object({ query: z.string().trim().min(1, "Scan a pass or enter a member ID or email").max(2000), locationId: z.string().min(1).max(40).optional() });

export const POST = staffRoute({ permission: "checkin.scan", body: Body, rateLimit: RATE_LIMITS.checkIn }, async ({ body, db, staff }) => {
  const { member, decision, method } = await checkInByQuery(db, staff, body.query, body.locationId);
  return json({
    granted: decision.granted,
    reason: decision.granted ? null : decision.reason,
    warning: decision.granted ? decision.warning : null,
    method,
    member: {
      id: member.id,
      name: member.name,
      status: member.status,
      plan: member.membershipPlan?.name ?? null,
      retentionScore: member.retentionScore,
      keycardIssued: member.keycardIssued,
    },
  });
});
