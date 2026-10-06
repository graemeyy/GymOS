import { staffRoute, json } from "@/lib/http/route";
import { importStatus, resendInvites } from "@/lib/import/service";

// How many imported members haven't set a password yet, and sending them new
// invitations.
export const GET = staffRoute({ permission: "data.import" }, async ({ db }) => json(await importStatus(db)));

export const POST = staffRoute({ permission: "data.import" }, async ({ db, staff }) => json(await resendInvites(db, staff)));
