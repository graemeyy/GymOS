import { staffRoute, json } from "@/lib/http/route";
import { CreateMemberBody, MemberListQuery } from "@/lib/members/schema";
import { listMembers } from "@/lib/members/queries";
import { createMember } from "@/lib/members/service";
import { canSeePrivateDetails, forViewer } from "@/lib/members/privacy";

// Email shows, and can be searched, only with members.view_sensitive.
export const GET = staffRoute({ permission: "members.view", query: MemberListQuery }, async ({ query, db, staff }) => {
  const page = await listMembers(db, query, { searchEmail: canSeePrivateDetails(staff) });
  return json({ ...page, items: page.items.map((m) => forViewer(staff, m)) });
});

export const POST = staffRoute({ permission: "members.edit", body: CreateMemberBody }, async ({ body, db, staff }) => json(await createMember(db, staff, body), 201));
