import { z } from "zod";
import { staffRoute, json } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { logAction } from "@/lib/audit";
import { emailAnnouncement } from "@/lib/announcements";

export const POST = staffRoute({ permission: "announcements:manage", body: z.object({ email: z.boolean().default(false) }) }, async ({ params, body, db, staff }) => {
  const existing = await db.announcement.findUnique({ where: { id: params.id } });
  if (!existing) throw new ApiError("not_found", "Announcement not found.");
  const a = existing.publishedAt ? existing : await db.announcement.update({ where: { id: params.id }, data: { publishedAt: new Date() } });
  const emailed = body.email ? await emailAnnouncement(db, a.id) : null;
  await logAction(db, staff, { action: "announcement.published", targetType: "Announcement", targetId: a.id, details: { title: a.title, emailed: emailed?.sent ?? 0 } });
  return json({ ok: true, emailed: emailed?.sent ?? 0 });
});
