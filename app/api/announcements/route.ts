import { staffRoute, json } from "@/lib/http/route";
import { AnnouncementBody, AnnouncementListQuery } from "@/lib/announcements/schema";
import { assertLocation } from "@/lib/locations/scope";
import { listAnnouncements } from "@/lib/announcements/queries";
import { createAnnouncement } from "@/lib/announcements/service";

// One location's (with those for everyone), or every location the person's
// role covers (D-128).
export const GET = staffRoute({ permission: null, query: AnnouncementListQuery }, async ({ db, staff, query }) => {
  if (query.locationId) assertLocation(staff, query.locationId);
  return json(await listAnnouncements(db, query.locationId ? [query.locationId] : staff.isOwner ? null : staff.locationIds));
});

export const POST = staffRoute({ permission: "announcements.send", body: AnnouncementBody }, async ({ body, db, staff }) => json(await createAnnouncement(db, staff, body), 201));
