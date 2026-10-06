import type { StaffRole } from "@prisma/client";
import { LEGACY_ROLE_PRESET, PRESETS, type Permission, type Preset } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth/token";
import { hashPassword } from "@/lib/auth/password";
import { presetRoleId, resetDatabase } from "@/prisma/seed-data";
import { syncPlansFromConfig } from "@/lib/plans/service";
import { MAIN_LOCATION_ID } from "@/lib/locations/constants";

export { prisma };

export async function resetDb() {
  await resetDatabase(prisma);
  await prisma.membershipPlan.deleteMany();
  await syncPlansFromConfig(prisma);
}

let counter = 0;
const unique = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;

// A preset role (OWNER, ADMIN, MANAGER, STAFF, TRAINER), a legacy role name
// (FRONT_DESK means STAFF), or { roleId } for a custom role.
export type StaffRoleArg = Preset | StaffRole | { roleId: string };

const LEGACY_FOR_PRESET: Record<Preset, StaffRole> = { OWNER: "OWNER", ADMIN: "MANAGER", MANAGER: "MANAGER", STAFF: "FRONT_DESK", TRAINER: "TRAINER" };

function resolveRole(role: StaffRoleArg): { roleId: string; legacy: StaffRole; label: string } {
  if (typeof role === "object") return { roleId: role.roleId, legacy: "FRONT_DESK", label: "CUSTOM" };
  const preset: Preset = (PRESETS as readonly string[]).includes(role) ? (role as Preset) : LEGACY_ROLE_PRESET[role as StaffRole];
  return { roleId: presetRoleId(preset), legacy: LEGACY_FOR_PRESET[preset], label: preset };
}

export async function createStaff(role: StaffRoleArg, overrides: { email?: string; password?: string } = {}) {
  const { roleId, legacy, label } = resolveRole(role);
  return prisma.staff.create({
    data: {
      name: `${label} ${unique()}`,
      email: overrides.email ?? `${label.toLowerCase()}-${unique()}@example.com`,
      role: legacy,
      roleId,
      passwordHash: await hashPassword(overrides.password ?? "correct-horse-battery"),
    },
  });
}

// Members default to the Unlimited plan so class bookings in tests aren't
// limited by credits; pass planSlug to test another plan.
// Members are created with a confirmed email, as staff-added and existing
// members are; pass emailVerified: false for an online sign-up that hasn't
// confirmed yet (D-114).
export async function createMember(overrides: Partial<{ email: string; name: string; password: string; status: "ACTIVE" | "PAUSED" | "PAST_DUE" | "CANCELED" | "PENDING"; stripeSubscriptionId: string; stripeCustomerId: string; planSlug: string; emailVerified: boolean }> = {}) {
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
      emailVerifiedAt: overrides.emailVerified === false ? null : new Date(),
    },
  });
}

export type As =
  | { staff: { id: string; name: string; sessionVersion: number } }
  | { member: { id: string; name: string | null; email: string; sessionVersion: number } }
  | null;

export async function cookieFor(as: As): Promise<string | undefined> {
  if (!as) return undefined;
  const token =
    "staff" in as
      ? await createSessionToken({ kind: "staff", sub: as.staff.id, name: as.staff.name, ver: as.staff.sessionVersion })
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

// A staff member on a custom role with exactly these permissions.
export async function createStaffWith(permissions: Permission[], name = `Custom ${unique()}`) {
  const role = await prisma.role.create({ data: { name, permissions } });
  return createStaff({ roleId: role.id });
}

// Stock is counted per location (D-127). Tests that create variants directly
// with Prisma call stockFromQty() to give each one its stockQty at the main
// location, then read and set stock with these.
export async function stockFromQty() {
  for (const v of await prisma.productVariant.findMany({ select: { id: true, stockQty: true } })) {
    await prisma.variantStock.upsert({ where: { variantId_locationId: { variantId: v.id, locationId: MAIN_LOCATION_ID } }, create: { variantId: v.id, locationId: MAIN_LOCATION_ID, quantity: v.stockQty }, update: {} });
  }
}

export async function stockOf(variantId: string, locationId = MAIN_LOCATION_ID) {
  return (await prisma.variantStock.findUnique({ where: { variantId_locationId: { variantId, locationId } } }))?.quantity ?? 0;
}

export async function setStock(variantId: string, quantity: number, locationId = MAIN_LOCATION_ID) {
  await prisma.variantStock.upsert({ where: { variantId_locationId: { variantId, locationId } }, create: { variantId, locationId, quantity }, update: { quantity } });
}
