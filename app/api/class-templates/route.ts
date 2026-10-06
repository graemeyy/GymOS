import { staffRoute, json } from "@/lib/http/route";
import { TemplateBody, TemplateListQuery } from "@/lib/classes/schema";
import { locationWhere } from "@/lib/locations/scope";
import { listTemplates } from "@/lib/classes/queries";
import { createTemplate } from "@/lib/classes/service";

export const GET = staffRoute({ permission: null, query: TemplateListQuery }, async ({ db, staff, query }) => json(await listTemplates(db, locationWhere(staff, query.locationId))));

export const POST = staffRoute({ permission: "classes.manage", body: TemplateBody }, async ({ body, db, staff }) => {
  return json(await createTemplate(db, staff, body), 201);
});
