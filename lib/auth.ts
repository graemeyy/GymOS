import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken, type SessionPayload } from "@/lib/session";
import { hasRole, type StaffRoleName } from "@/lib/roles";

function getCookie(request: Request, name: string): string | undefined {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return undefined;
  const match = cookieHeader.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}

export async function getSession(request: Request): Promise<SessionPayload | null> {
  return verifySessionToken(getCookie(request, SESSION_COOKIE));
}

// Returns null (caller proceeds) if the session meets the minimum role, or a
// 401/403 response to return immediately otherwise.
export async function requireRole(request: Request, min: StaffRoleName): Promise<NextResponse | null> {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (!hasRole(session.role, min)) {
    return NextResponse.json({ error: "Not authorized for this action" }, { status: 403 });
  }
  return null;
}
