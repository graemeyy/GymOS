import { z } from "zod";
import { publicRoute, json, zEmail, zName, zPassword } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { env } from "@/lib/env";
import { hashPassword } from "@/lib/auth/password";
import { timingSafeEqualStrings } from "@/lib/auth/token";
import { logAction } from "@/lib/audit";
import { RATE_LIMITS } from "@/lib/rate-limit";

export const GET = publicRoute({}, async ({ db }) => json({ needsSetup: (await db.staff.count()) === 0, tokenRequired: Boolean(env().SETUP_TOKEN) }));

const Body = z.object({ name: zName, email: zEmail, password: zPassword, setupToken: z.string().max(200).optional() });

// Creates the very first staff account, as OWNER, and then refuses forever.
// With SETUP_TOKEN set, the token is required; a production deployment
// without one refuses, so whoever finds a new site first can't own it (R-42).
// An advisory lock serialises two simultaneous first-run requests.
export const POST = publicRoute({ body: Body, rateLimit: RATE_LIMITS.bootstrap }, async ({ body, db }) => {
  const { SETUP_TOKEN, NODE_ENV } = env();
  if (!SETUP_TOKEN && NODE_ENV === "production") {
    throw new ApiError("not_configured", "Set SETUP_TOKEN in the environment to create the first owner account.");
  }
  if (SETUP_TOKEN && !timingSafeEqualStrings(body.setupToken ?? "", SETUP_TOKEN)) {
    throw new ApiError("forbidden", "That setup token isn't right.", { setupToken: "Doesn't match" });
  }
  const passwordHash = await hashPassword(body.password);
  const staff = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(424242)`;
    if ((await tx.staff.count()) > 0) throw new ApiError("conflict", "Setup has already been completed.");
    const created = await tx.staff.create({ data: { name: body.name, email: body.email, passwordHash, role: "OWNER" } });
    await logAction(tx, { kind: "staff", id: created.id, name: created.name, role: "OWNER" }, {
      action: "staff.created",
      targetType: "Staff",
      targetId: created.id,
      details: { role: "OWNER", note: "Initial setup" },
    });
    return created;
  });
  return json({ id: staff.id }, 201);
});
