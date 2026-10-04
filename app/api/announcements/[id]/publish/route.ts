import { staffRoute, json } from "@/lib/http/route";
import { PublishAnnouncementBody } from "@/lib/announcements/schema";
import { publishAnnouncement } from "@/lib/announcements/service";

export const POST = staffRoute({ permission: "announcements:manage", body: PublishAnnouncementBody }, async ({ params, body, db, staff }) => {
  const emailed = await publishAnnouncement(db, staff, params.id, body.email);
  return json({ ok: true, emailed });
});
