import { staffRoute, json } from "@/lib/http/route";
import { CreateMemberBody, MemberListQuery } from "@/lib/members/schema";
import { listMembers } from "@/lib/members/queries";
import { createMember } from "@/lib/members/service";

export const GET = staffRoute({ permission: "members:read", query: MemberListQuery }, async ({ query, db }) => json(await listMembers(db, query)));

export const POST = staffRoute({ permission: "members:write", body: CreateMemberBody }, async ({ body, db, staff }) => json(await createMember(db, staff, body), 201));
