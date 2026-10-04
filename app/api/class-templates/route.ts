import { staffRoute, json } from "@/lib/http/route";
import { TemplateBody } from "@/lib/classes/schema";
import { listTemplates } from "@/lib/classes/queries";
import { createTemplate } from "@/lib/classes/service";

export const GET = staffRoute({ permission: "classes:read" }, async ({ db }) => json(await listTemplates(db)));

export const POST = staffRoute({ permission: "classes:manage", body: TemplateBody }, async ({ body, db, staff }) => {
  return json(await createTemplate(db, staff, body), 201);
});
