import { memberRoute, json } from "@/lib/http/route";
import { listAnnouncementsForMember } from "@/lib/announcements/queries";

// Live announcements for the signed-in member's audience.
export const GET = memberRoute({}, async ({ db, member }) => json(await listAnnouncementsForMember(db, member.id)));
