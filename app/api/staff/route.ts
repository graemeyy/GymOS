import { z } from "zod";
import { staffRoute, json, zEmail, zName, zPassword } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { logAction } from "@/lib/audit";
import { hashPassword } from "@/lib/auth/password";
import { STAFF_ROLES } from "@/lib/auth/permissions";

const select = { id: true, name: true, email: true, role: true, createdAt: true } as const;

export const GET = staffRoute({ permission: "staff:read" }, async ({ db }) => {
  return json(await db.staff.findMany({ orderBy: { createdAt: "asc" }, select }));
});

const Body = z.object({ name: zName, email: zEmail, password: zPassword, role: z.enum(STAFF_ROLES) });

export const POST = staffRoute({ permission: "staff:manage", body: Body }, async ({ body, db, staff }) => {
  if (await db.staff.findUnique({ where: { email: body.email } })) {
    throw new ApiError("conflict", "A staff account with that email already exists.", { email: "Already in use" });
  }
  const created = await db.staff.create({
    data: { name: body.name, email: body.email, role: body.role, passwordHash: await hashPassword(body.password) },
    select,
  });
  await logAction(db, staff, { action: "staff.created", targetType: "Staff", targetId: created.id, details: { name: body.name, email: body.email, role: body.role } });
  return json(created, 201);
});
