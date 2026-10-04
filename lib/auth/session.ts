import { NextResponse } from "next/server";
import { prisma, type Db } from "@/lib/db";
import { ApiError } from "@/lib/http/errors";
import { env } from "@/lib/env";
import { can, type Permission, type StaffRoleName } from "./permissions";
import {
  createSessionToken,
  readCookie,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  verifySessionToken,
  type SessionInput,
  type SessionPayload,
} from "./token";

export interface StaffActor {
  kind: "staff";
  id: string;
  name: string;
  role: StaffRoleName;
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
  const staff = await db.staff.findUnique({
    where: { id: session.sub },
    select: { id: true, name: true, role: true, sessionVersion: true },
  });
  if (!staff || staff.sessionVersion !== session.ver) return null;
  return { kind: "staff", id: staff.id, name: staff.name, role: staff.role };
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

export async function hideRevenueFromFrontDesk(db: Db = prisma): Promise<boolean> {
  const settings = await db.gymSettings.findUnique({ where: { id: "singleton" } });
  return settings?.hideRevenueFromFrontDesk ?? false;
}

// Whether this staff member may see money figures (takings, amounts owing,
// plan revenue). Front desk can be blocked by the owner's setting.
export async function canSeeRevenue(staff: StaffActor, db: Db = prisma): Promise<boolean> {
  return can(staff.role, "revenue:view", { hideRevenueFromFrontDesk: await hideRevenueFromFrontDesk(db) });
}

export async function requireStaff(request: Request, permission: Permission, db: Db = prisma): Promise<StaffActor> {
  const staff = await resolveStaff(request, db);
  if (!staff) throw new ApiError("unauthenticated", "Please sign in as staff.");
  const ctx = permission === "revenue:view" ? { hideRevenueFromFrontDesk: await hideRevenueFromFrontDesk(db) } : {};
  if (!can(staff.role, permission, ctx)) {
    throw new ApiError("forbidden", "Your role doesn't have access to this.");
  }
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
