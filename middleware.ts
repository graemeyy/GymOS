import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export const config = {
  // "/" and "/radar" show individual member records (names, retention scores)
  // alongside the dedicated /members and /iot consoles, so they get the same gate.
  // /reception, /billing, /equipment and /marketing stay open (kiosk / public / non-PII).
  matcher: ["/", "/members/:path*", "/iot/:path*", "/radar/:path*", "/api/members/:path*"],
};

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const authenticated = await verifySessionToken(token);

  if (authenticated) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("from", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}
