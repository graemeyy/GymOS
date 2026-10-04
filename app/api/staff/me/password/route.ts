import { z } from "zod";
import { staffRoute, json, zPassword } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";
import { logAction } from "@/lib/audit";
import { RATE_LIMITS } from "@/lib/rate-limit";

const Body = z.object({ currentPassword: z.string().min(1).max(200), newPassword: zPassword });

// Any staff member can change their own password. Other sessions for the
// account end; this one gets a fresh cookie.
// Rate limited, so a stolen session can't be used to guess the current
// password (R-45).
export const POST = staffRoute({ permission: "dashboard:view", body: Body, rateLimit: RATE_LIMITS.loginStaff }, async ({ body, db, staff }) => {
  const record = await db.staff.findUniqueOrThrow({ where: { id: staff.id } });
  if (!(await verifyPassword(body.currentPassword, record.passwordHash))) {
    throw new ApiError("validation_failed", "That isn't your current password.", { currentPassword: "Incorrect" });
  }
  const updated = await db.staff.update({ where: { id: staff.id }, data: { passwordHash: await hashPassword(body.newPassword), sessionVersion: { increment: 1 } } });
  await logAction(db, staff, { action: "staff.password_changed", targetType: "Staff", targetId: staff.id });
  const response = json({ ok: true });
  await setSessionCookie(response, { kind: "staff", sub: updated.id, name: updated.name, role: updated.role, ver: updated.sessionVersion });
  return response;
});
