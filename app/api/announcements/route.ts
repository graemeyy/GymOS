import { staffRoute, json } from "@/lib/http/route";
import { logAction } from "@/lib/audit";
import { AnnouncementBody } from "@/lib/announcement-schema";

export const GET = staffRoute({ permission: "dashboard:view" }, async ({ db }) => {
  return json(await db.announcement.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { plan: { select: { name: true } }, createdBy: { select: { name: true } } } }));
});

export const POST = staffRoute({ permission: "announcements:manage", body: AnnouncementBody }, async ({ body, db, staff }) => {
  const a = await db.announcement.create({ data: { ...body, planId: body.audience === "PLAN" ? body.planId : null, expiresAt: body.expiresAt ?? null, createdById: staff.id } });
  await logAction(db, staff, { action: "announcement.created", targetType: "Announcement", targetId: a.id, details: { title: a.title } });
  return json(a, 201);
});
