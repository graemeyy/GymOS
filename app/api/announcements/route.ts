import { staffRoute, json } from "@/lib/http/route";
import { AnnouncementBody } from "@/lib/announcements/schema";
import { listAnnouncements } from "@/lib/announcements/queries";
import { createAnnouncement } from "@/lib/announcements/service";

export const GET = staffRoute({ permission: null }, async ({ db }) => json(await listAnnouncements(db)));

export const POST = staffRoute({ permission: "announcements.send", body: AnnouncementBody }, async ({ body, db, staff }) => json(await createAnnouncement(db, staff, body), 201));
