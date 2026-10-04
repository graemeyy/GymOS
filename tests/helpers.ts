import type { StaffRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth/token";
import { hashPassword } from "@/lib/auth/password";
import { resetDatabase } from "@/prisma/seed-data";
import { syncPlansFromConfig } from "@/lib/plans";

export { prisma };

export async function resetDb() {
  await resetDatabase(prisma);
  await prisma.membershipPlan.deleteMany();
  await syncPlansFromConfig(prisma);
}

let counter = 0;
const unique = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;

export async function createStaff(role: StaffRole, overrides: { email?: string; password?: string } = {}) {
  return prisma.staff.create({
    data: {
      name: `${role} ${unique()}`,
      email: overrides.email ?? `${role.toLowerCase()}-${unique()}@example.com`,
      role,
      passwordHash: await hashPassword(overrides.password ?? "correct-horse-battery"),
    },
  });
}

// Members default to the Unlimited plan so class bookings in tests aren't
// limited by credits; pass planSlug to test another plan.
export async function createMember(overrides: Partial<{ email: string; name: string; password: string; status: "ACTIVE" | "PAUSED" | "PAST_DUE" | "CANCELED" | "PENDING"; stripeSubscriptionId: string; stripeCustomerId: string; planSlug: string }> = {}) {
  const plan = await prisma.membershipPlan.findUniqueOrThrow({ where: { slug: overrides.planSlug ?? "unlimited" } });
  return prisma.member.create({
    data: {
      name: overrides.name ?? `Member ${unique()}`,
      email: overrides.email ?? `member-${unique()}@example.com`,
      status: overrides.status ?? "ACTIVE",
      planId: plan.id,
      passwordHash: overrides.password ? await hashPassword(overrides.password) : null,
      stripeSubscriptionId: overrides.stripeSubscriptionId,
      stripeCustomerId: overrides.stripeCustomerId,
    },
  });
}

export type As =
  | { staff: { id: string; name: string; role: StaffRole; sessionVersion: number } }
  | { member: { id: string; name: string | null; email: string; sessionVersion: number } }
  | null;

export async function cookieFor(as: As): Promise<string | undefined> {
  if (!as) return undefined;
  const token =
    "staff" in as
      ? await createSessionToken({ kind: "staff", sub: as.staff.id, name: as.staff.name, role: as.staff.role, ver: as.staff.sessionVersion })
      : await createSessionToken({ kind: "member", sub: as.member.id, name: as.member.name ?? "", ver: as.member.sessionVersion });
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}`;
}

export async function makeRequest(
  method: string,
  path: string,
  opts: { as?: As; body?: unknown; headers?: Record<string, string> } = {}
): Promise<Request> {
  const headers: Record<string, string> = { host: "localhost:3000", origin: "http://localhost:3000", ...opts.headers };
  const cookie = await cookieFor(opts.as ?? null);
  if (cookie) headers.cookie = cookie;
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  return new Request(`http://localhost:3000${path}`, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
}

type Handler = (request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response>;

export async function call(handler: Handler, request: Request, params: Record<string, string> = {}) {
  const response = await handler(request, { params: Promise.resolve(params) });
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, body: body as Record<string, unknown> & { error?: { code: string; message: string; fields?: Record<string, string> } }, headers: response.headers };
}
