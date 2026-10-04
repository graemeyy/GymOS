import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { staffRoute, json, zEmail, zName, zId } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { logAction } from "@/lib/audit";
import { assertPlan, assertReferrer, MEMBER_STATUSES, memberListSelect } from "@/lib/members/service";

const Query = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(MEMBER_STATUSES).optional(),
  planId: zId.optional(),
  archived: z.enum(["only", "include", "exclude"]).default("exclude"),
  take: z.coerce.number().int().min(1).max(500).default(200),
  cursor: zId.optional(),
});

export const GET = staffRoute({ permission: "members:read", query: Query }, async ({ query, db }) => {
  const where: Prisma.MemberWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.planId ? { planId: query.planId } : {}),
    ...(query.archived === "exclude" ? { archivedAt: null } : query.archived === "only" ? { archivedAt: { not: null } } : {}),
    ...(query.q
      ? { OR: [{ name: { contains: query.q, mode: "insensitive" } }, { email: { contains: query.q, mode: "insensitive" } }] }
      : {}),
  };
  const rows = await db.member.findMany({
    where,
    select: memberListSelect,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: query.take + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > query.take;
  const items = hasMore ? rows.slice(0, query.take) : rows;
  return json({ items, nextCursor: hasMore ? items[items.length - 1].id : null });
});

const CreateBody = z.object({
  name: zName,
  email: zEmail,
  planId: zId.nullable().optional(),
  referredById: zId.nullable().optional(),
});

// Front desk can add a member. New members start ACTIVE on the chosen plan;
// payment is set up separately (the member's own checkout, or Stripe).
export const POST = staffRoute({ permission: "members:write", body: CreateBody }, async ({ body, db, staff }) => {
  await assertReferrer(db, body.referredById);
  await assertPlan(db, body.planId);
  const existing = await db.member.findUnique({ where: { email: body.email }, select: { id: true } });
  if (existing) throw new ApiError("conflict", "A member with that email already exists.", { email: "Already in use" });

  const member = await db.member.create({
    data: { name: body.name, email: body.email, planId: body.planId ?? null, referredById: body.referredById ?? null },
    select: memberListSelect,
  });
  await logAction(db, staff, {
    action: "member.created",
    targetType: "Member",
    targetId: member.id,
    details: { name: body.name, email: body.email, planId: member.planId, referredById: member.referredById },
  });
  return json(member, 201);
});
