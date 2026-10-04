import { z } from "zod";
import { staffRoute, json } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { logAction } from "@/lib/audit";
import { adjustBenefit, getBenefitUsage } from "@/lib/membership/benefits";

export const GET = staffRoute({ permission: "members:read" }, async ({ params, db }) => {
  const [usage, history] = await Promise.all([
    getBenefitUsage(db, params.id),
    db.benefitLedger.findMany({ where: { memberId: params.id }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  return json({ ...usage, history });
});

const Body = z.object({
  kind: z.enum(["CLASS_CREDIT", "GUEST_PASS", "ACCOUNT_CREDIT"]),
  delta: z.number().int().min(-100_000).max(100_000).refine((d) => d !== 0, "Must not be zero"),
  reason: z.string().trim().min(3, "Say why").max(300),
});

// Manual adjustments: extra classes as a goodwill gesture, a guest pass, or
// account credit in cents. Manager or owner only, always with a reason.
export const POST = staffRoute({ permission: "billing:manage", body: Body }, async ({ params, body, db, staff }) => {
  const member = await db.member.findUnique({ where: { id: params.id }, select: { id: true, archivedAt: true } });
  if (!member) throw new ApiError("not_found", "Member not found.");
  if (member.archivedAt) throw new ApiError("conflict", "This member is archived.");
  const entry = await adjustBenefit(db, { memberId: params.id, kind: body.kind, delta: body.delta, reason: body.reason, staffId: staff.id });
  await logAction(db, staff, { action: "member.benefit_adjusted", targetType: "Member", targetId: params.id, details: body });
  return json(entry, 201);
});
