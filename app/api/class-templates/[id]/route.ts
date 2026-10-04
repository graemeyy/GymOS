import { staffRoute, json } from "@/lib/http/route";
import { TemplateBody } from "@/lib/classes/schema";
import { deleteTemplate, updateTemplate } from "@/lib/classes/service";

export const PUT = staffRoute({ permission: "classes:manage", body: TemplateBody }, async ({ params, body, db, staff }) => {
  return json(await updateTemplate(db, staff, params.id, body));
});

export const DELETE = staffRoute({ permission: "classes:manage" }, async ({ params, db, staff }) => {
  await deleteTemplate(db, staff, params.id);
  return json({ ok: true });
});
