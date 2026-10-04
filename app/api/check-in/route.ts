import { z } from "zod";
import { staffRoute, json } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { checkInMember } from "@/lib/checkin/service";

// Front-desk check-in. Staff only: this used to be public and leaked member
// details to anyone who guessed an email (audit S2).
export const GET = staffRoute({ permission: "checkin:scan" }, async ({ db }) => {
  const checkIns = await db.checkIn.findMany({
    take: 15,
    orderBy: { timestamp: "desc" },
    select: { id: true, location: true, timestamp: true, member: { select: { id: true, name: true, status: true } } },
  });
  return json(checkIns);
});

const Body = z.object({ query: z.string().trim().min(1, "Enter a member ID or email").max(254) });

export const POST = staffRoute({ permission: "checkin:scan", body: Body, rateLimit: RATE_LIMITS.checkIn }, async ({ body, db, staff }) => {
  const isEmail = body.query.includes("@");
  const found = await db.member.findFirst({
    where: isEmail ? { email: body.query.toLowerCase() } : { id: body.query },
    select: { id: true },
  });
  if (!found) throw new ApiError("not_found", "No member matches that ID or email.");
  const { member, decision } = await checkInMember(db, staff, found.id, "Front desk");
  return json({
    granted: decision.granted,
    reason: decision.granted ? null : decision.reason,
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
