import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export const config = {
  // Protect everything except: the public marketing page, the login/setup
  // flow, the reception kiosk (front-desk walk-up screen, no per-staff
  // login) and the check-in API it calls, auth/webhook/cron/IoT API routes
  // (their own auth schemes), and Next's own static assets.
  matcher: [
    "/((?!api/auth|api/webhooks|api/cron|api/iot|api/check-in|login|setup|marketing|reception|_next/static|_next/image|favicon.ico).*)",
  ],
};

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);

  if (session) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("from", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}
