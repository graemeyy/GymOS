import { z } from "zod";
import { staffRoute, json } from "@/lib/http/route";
import { listMemberNotes } from "@/lib/members/queries";
import { addMemberNote } from "@/lib/members/service";

export const GET = staffRoute({ permission: "members:read" }, async ({ params, db }) => json(await listMemberNotes(db, params.id)));

const Body = z.object({ body: z.string().trim().min(1, "Write a note").max(2000) });

export const POST = staffRoute({ permission: "members:write", body: Body }, async ({ params, body, db, staff }) => json(await addMemberNote(db, staff, params.id, body.body), 201));
