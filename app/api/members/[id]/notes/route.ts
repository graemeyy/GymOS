import { z } from "zod";
import { staffRoute, json } from "@/lib/http/route";
import { listMemberNotes } from "@/lib/members/queries";
import { addMemberNote } from "@/lib/members/service";

// Staff notes are private details.
export const GET = staffRoute({ permission: "members.view_sensitive" }, async ({ params, db }) => json(await listMemberNotes(db, params.id)));

const Body = z.object({ body: z.string().trim().min(1, "Write a note").max(2000) });

export const POST = staffRoute({ permission: "members.edit", body: Body }, async ({ params, body, db, staff }) => json(await addMemberNote(db, staff, params.id, body.body), 201));
