import { NextResponse } from "next/server";
import { prisma, type Db } from "@/lib/db";
import { ApiError } from "@/lib/http/errors";
import { env } from "@/lib/env";
import { assertSignInAllowed, RATE_LIMITS, recordFailedSignIn } from "@/lib/rate-limit";
import { allows, can, effectivePermissions, type Access, type PermissionRule } from "./permissions";
import { verifyPasswordOrDummy } from "./password";
import {
  createSessionToken,
  readCookie,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  verifySessionToken,
  type SessionInput,
  type SessionPayload,
} from "./token";

export interface StaffActor extends Access {
  kind: "staff";
  id: string;
  name: string;
  roleId: string;
  roleName: string;
}

export interface MemberActor {
  kind: "member";
  id: string;
  name: string;
  email: string;
}

export async function readSession(request: Request): Promise<SessionPayload | null> {
  return verifySessionToken(readCookie(request.headers.get("cookie"), SESSION_COOKIE));
}

// The signed cookie proves who the caller was when they signed in. This
// re-checks the database so that a deleted account, a changed role, a sign-out
// everywhere, or an archived member takes effect on the next request instead
// of after the 12-hour token expiry.
export async function resolveStaff(request: Request, db: Db = prisma): Promise<StaffActor | null> {
  const session = await readSession(request);
  if (!session || session.kind !== "staff") return null;
  return loadStaffActor(db, session.sub, session.ver);
}

// The staff member's current access, read from their role on every request,
// so a role edit or a deactivation applies straight away (D-098). No role, or
// a deactivated account, means no access.
export async function loadStaffActor(db: Db, id: string, sessionVersion?: number): Promise<StaffActor | null> {
  const staff = await db.staff.findUnique({
    where: { id },
    select: { id: true, name: true, sessionVersion: true, deactivatedAt: true, assignedRole: { select: { id: true, name: true, isOwner: true, permissions: true } } },
  });
  if (!staff || staff.deactivatedAt || !staff.assignedRole) return null;
  if (sessionVersion !== undefined && staff.sessionVersion !== sessionVersion) return null;
  const role = staff.assignedRole;
  return { kind: "staff", id: staff.id, name: staff.name, roleId: role.id, roleName: role.name, isOwner: role.isOwner, permissions: effectivePermissions(role) };
}

export async function resolveMember(request: Request, db: Db = prisma): Promise<MemberActor | null> {
  const session = await readSession(request);
  if (!session || session.kind !== "member") return null;
  const member = await db.member.findUnique({
    where: { id: session.sub },
    select: { id: true, name: true, email: true, sessionVersion: true, archivedAt: true },
  });
  if (!member || member.archivedAt || member.sessionVersion !== session.ver) return null;
  return { kind: "member", id: member.id, name: member.name ?? member.email, email: member.email };
}

// Sign-in checks the per-account lockouts before the password. Only failed
// attempts count towards them (R-40).
export async function signInStaff(db: Db, email: string, password: string, ip: string) {
  const accountKey = `staff:${email}`;
  const accountFromHere = `${accountKey}:${ip}`;
  await assertSignInAllowed(RATE_LIMITS.loginAccount, accountFromHere, db);
  await assertSignInAllowed(RATE_LIMITS.loginAccountAnywhere, accountKey, db);
  const staff = await db.staff.findUnique({ where: { email } });
  const ok = await verifyPasswordOrDummy(password, staff?.passwordHash);
  if (!staff || !ok) {
    await recordFailedSignIn(RATE_LIMITS.loginAccount, accountFromHere, db);
    await recordFailedSignIn(RATE_LIMITS.loginAccountAnywhere, accountKey, db);
    throw new ApiError("unauthenticated", "That email and password don't match a staff account.");
  }
  // Only after the password is right, so this doesn't reveal which emails
  // belong to staff.
  if (staff.deactivatedAt || !staff.roleId) throw new ApiError("forbidden", "This staff account has been deactivated. Ask the gym's owner to turn it back on.");
  return staff;
}

// Archived members can't sign in.
export async function signInMember(db: Db, email: string, password: string, ip: string) {
  const accountKey = `member:${email}`;
  const accountFromHere = `${accountKey}:${ip}`;
  await assertSignInAllowed(RATE_LIMITS.loginAccount, accountFromHere, db);
  await assertSignInAllowed(RATE_LIMITS.loginAccountAnywhere, accountKey, db);
  const member = await db.member.findUnique({ where: { email } });
  const ok = await verifyPasswordOrDummy(password, member?.archivedAt ? null : member?.passwordHash);
  if (!member || !ok) {
    await recordFailedSignIn(RATE_LIMITS.loginAccount, accountFromHere, db);
    await recordFailedSignIn(RATE_LIMITS.loginAccountAnywhere, accountKey, db);
    throw new ApiError("unauthenticated", "That email and password don't match a member account.");
  }
  return member;
}

// Bumping the account's session version ends the session it was given and
// every other one for that account. Stateless tokens can't be revoked one at
// a time; see docs/DECISIONS.md.
export async function endAllSessions(db: Db, session: SessionPayload) {
  if (session.kind === "staff") {
    await db.staff.updateMany({ where: { id: session.sub, sessionVersion: session.ver }, data: { sessionVersion: { increment: 1 } } });
  } else {
    await db.member.updateMany({ where: { id: session.sub, sessionVersion: session.ver }, data: { sessionVersion: { increment: 1 } } });
  }
}

// Whether this staff member may see money figures (takings, amounts owing,
// plan member counts).
export function canSeeRevenue(staff: StaffActor): boolean {
  return can(staff, "finance.view");
}

// The one check behind every staff route: signed in as active staff, and,
// when a permission is named, holding it. `null` means any active staff
// member (schedules, the roster and other day-to-day views).
export async function requireStaff(request: Request, permission: PermissionRule, db: Db = prisma): Promise<StaffActor> {
  const staff = await resolveStaff(request, db);
  if (!staff) throw new ApiError("unauthenticated", "Please sign in as staff.");
  if (!allows(staff, permission)) throw new ApiError("forbidden", "Your role doesn't have access to this.");
  return staff;
}

export async function requireMember(request: Request, db: Db = prisma): Promise<MemberActor> {
  const member = await resolveMember(request, db);
  if (!member) throw new ApiError("unauthenticated", "Please sign in.");
  return member;
}

// Secure whenever the site is served over HTTPS, not only when NODE_ENV says
// production, so a staging site run in development mode still gets it (R-82).
function secureCookies() {
  return env().NODE_ENV === "production" || env().NEXT_PUBLIC_APP_URL.startsWith("https://");
}

export async function setSessionCookie(response: NextResponse, input: SessionInput): Promise<void> {
  const token = await createSessionToken(input);
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
