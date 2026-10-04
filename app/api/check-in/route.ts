import { z } from "zod";
import { staffRoute, json } from "@/lib/http/route";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { listRecentCheckIns } from "@/lib/checkin/queries";
import { checkInByQuery } from "@/lib/checkin/service";

// Front-desk check-in. Staff only: this used to be public and leaked member
// details to anyone who guessed an email (audit S2).
export const GET = staffRoute({ permission: "checkin:scan" }, async ({ db }) => json(await listRecentCheckIns(db)));

const Body = z.object({ query: z.string().trim().min(1, "Scan a pass or enter a member ID or email").max(2000) });

export const POST = staffRoute({ permission: "checkin:scan", body: Body, rateLimit: RATE_LIMITS.checkIn }, async ({ body, db, staff }) => {
  const { member, decision, method } = await checkInByQuery(db, staff, body.query);
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
