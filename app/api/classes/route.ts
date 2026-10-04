import { staffRoute, json } from "@/lib/http/route";
import { ClassBody, ClassListQuery } from "@/lib/classes/schema";
import { listClasses } from "@/lib/classes/queries";
import { createClass } from "@/lib/classes/service";

export const GET = staffRoute({ permission: "classes:read", query: ClassListQuery }, async ({ query, db, staff }) => {
  return json(await listClasses(db, { from: query.from, to: query.to, trainerId: query.mine === "1" ? staff.id : undefined }));
});

export const POST = staffRoute({ permission: "classes:manage", body: ClassBody }, async ({ body, db, staff }) => {
  return json(await createClass(db, staff, body), 201);
});
