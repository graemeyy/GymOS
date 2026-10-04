import { z } from "zod";
import { staffRoute, json } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { logAction } from "@/lib/audit";

export const GET = staffRoute({ permission: "members:read" }, async ({ params, db }) => {
  return json(await db.memberNote.findMany({ where: { memberId: params.id }, orderBy: { createdAt: "desc" }, take: 100 }));
});

const Body = z.object({ body: z.string().trim().min(1, "Write a note").max(2000) });

// Notes are append-only: they record who said what and when.
export const POST = staffRoute({ permission: "members:write", body: Body }, async ({ params, body, db, staff }) => {
  const member = await db.member.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!member) throw new ApiError("not_found", "Member not found.");
  const note = await db.memberNote.create({ data: { memberId: params.id, staffId: staff.id, staffName: staff.name, body: body.body } });
  await logAction(db, staff, { action: "member.note_added", targetType: "Member", targetId: params.id, details: { noteId: note.id } });
  return json(note, 201);
});
