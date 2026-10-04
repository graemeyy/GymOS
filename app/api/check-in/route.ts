import { z } from "zod";
import { staffRoute, json } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { checkInMember } from "@/lib/checkin/service";
import { readPassToken } from "@/lib/checkin/qr";

// Front-desk check-in. Staff only: this used to be public and leaked member
// details to anyone who guessed an email (audit S2).
export const GET = staffRoute({ permission: "checkin:scan" }, async ({ db }) => {
  const checkIns = await db.checkIn.findMany({
    take: 15,
    orderBy: { timestamp: "desc" },
    select: { id: true, location: true, method: true, timestamp: true, member: { select: { id: true, name: true, status: true } } },
  });
  return json(checkIns);
});

const Body = z.object({ query: z.string().trim().min(1, "Scan a pass or enter a member ID or email").max(2000) });

export const POST = staffRoute({ permission: "checkin:scan", body: Body, rateLimit: RATE_LIMITS.checkIn }, async ({ body, db, staff }) => {
  let memberId: string | null = null;
  let method: "MANUAL" | "QR" = "MANUAL";
  if (body.query.startsWith("GYM1.")) {
    const pass = await readPassToken(body.query);
    if (!pass) throw new ApiError("not_found", "That pass isn't valid.");
    const member = await db.member.findUnique({ where: { id: pass.m }, select: { id: true, qrVersion: true } });
    if (!member || member.qrVersion !== pass.v) throw new ApiError("conflict", "That pass has been replaced. Ask the member to open their current pass.");
    memberId = member.id;
    method = "QR";
  } else {
    const isEmail = body.query.includes("@");
    const found = await db.member.findFirst({ where: isEmail ? { email: body.query.toLowerCase() } : { id: body.query }, select: { id: true } });
    if (!found) throw new ApiError("not_found", "No member matches that ID or email.");
    memberId = found.id;
  }
  const { member, decision } = await checkInMember(db, staff, memberId, "Front desk", method);
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
