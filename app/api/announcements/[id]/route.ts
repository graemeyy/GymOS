import { staffRoute, json } from "@/lib/http/route";
import { AnnouncementBody } from "@/lib/announcements/schema";
import { deleteAnnouncement, updateAnnouncement } from "@/lib/announcements/service";

export const PUT = staffRoute({ permission: "announcements.send", body: AnnouncementBody }, async ({ params, body, db, staff }) => json(await updateAnnouncement(db, staff, params.id, body)));

export const DELETE = staffRoute({ permission: "announcements.send" }, async ({ params, db, staff }) => {
  await deleteAnnouncement(db, staff, params.id);
  return json({ ok: true });
});
