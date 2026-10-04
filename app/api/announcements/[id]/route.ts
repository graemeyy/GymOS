import { staffRoute, json } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { logAction } from "@/lib/audit";
import { AnnouncementBody } from "@/lib/announcement-schema";

export const PUT = staffRoute({ permission: "announcements:manage", body: AnnouncementBody }, async ({ params, body, db, staff }) => {
  const existing = await db.announcement.findUnique({ where: { id: params.id } });
  if (!existing) throw new ApiError("not_found", "Announcement not found.");
  if (existing.emailedAt) throw new ApiError("conflict", "This announcement has already been emailed, so it can't be edited. Post a correction instead.");
  const a = await db.announcement.update({ where: { id: params.id }, data: { ...body, planId: body.audience === "PLAN" ? body.planId : null, expiresAt: body.expiresAt ?? null } });
  await logAction(db, staff, { action: "announcement.updated", targetType: "Announcement", targetId: a.id, details: { title: a.title } });
  return json(a);
});

export const DELETE = staffRoute({ permission: "announcements:manage" }, async ({ params, db, staff }) => {
  const a = await db.announcement.delete({ where: { id: params.id } });
  await logAction(db, staff, { action: "announcement.deleted", targetType: "Announcement", targetId: a.id, details: { title: a.title } });
  return json({ ok: true });
});
