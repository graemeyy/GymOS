import { staffRoute, json } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { logAction } from "@/lib/audit";
import { TemplateBody } from "@/lib/classes/template-schema";

export const GET = staffRoute({ permission: "classes:read" }, async ({ db }) => {
  return json(await db.classTemplate.findMany({ orderBy: [{ weekday: "asc" }, { startTime: "asc" }], include: { trainer: { select: { id: true, name: true } } } }));
});

export const POST = staffRoute({ permission: "classes:manage", body: TemplateBody }, async ({ body, db, staff }) => {
  if (body.trainerId && !(await db.staff.findUnique({ where: { id: body.trainerId } }))) throw new ApiError("validation_failed", "That trainer doesn't exist.", { trainerId: "Not found" });
  const t = await db.classTemplate.create({ data: { ...body, trainerId: body.trainerId ?? null } });
  await logAction(db, staff, { action: "timetable.slot_created", targetType: "ClassTemplate", targetId: t.id, details: { name: t.name, weekday: t.weekday, startTime: t.startTime } });
  return json(t, 201);
});
