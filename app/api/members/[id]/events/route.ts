import { staffRoute, json } from "@/lib/http/route";

export const GET = staffRoute({ permission: "members:read" }, async ({ params, db }) => {
  return json(await db.membershipEvent.findMany({ where: { memberId: params.id }, orderBy: { createdAt: "desc" }, take: 50 }));
});
