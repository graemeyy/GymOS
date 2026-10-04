import { staffRoute, json } from "@/lib/http/route";
import { logAction } from "@/lib/audit";
import { TemplateBody } from "@/lib/classes/template-schema";

// Editing a slot affects classes generated from now on; existing dated
// classes are left as they are (members may already be booked).
export const PUT = staffRoute({ permission: "classes:manage", body: TemplateBody }, async ({ params, body, db, staff }) => {
  const t = await db.classTemplate.update({ where: { id: params.id }, data: { ...body, trainerId: body.trainerId ?? null } });
  await logAction(db, staff, { action: "timetable.slot_updated", targetType: "ClassTemplate", targetId: t.id, details: { name: t.name } });
  return json(t);
});

export const DELETE = staffRoute({ permission: "classes:manage" }, async ({ params, db, staff }) => {
  const t = await db.classTemplate.delete({ where: { id: params.id } });
  await logAction(db, staff, { action: "timetable.slot_deleted", targetType: "ClassTemplate", targetId: t.id, details: { name: t.name } });
  return json({ ok: true });
});
