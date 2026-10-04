import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/token";

// Page-level gate only: sends signed-out visitors to the right sign-in page.
// It is not the security boundary. Every API route checks the session and the
// caller's permission itself, against the database (lib/http/route.ts), so a
// middleware bypass can't expose data.
export const config = {
  matcher: ["/admin/:path*", "/member/:path*"],
};

const PUBLIC_ADMIN = new Set(["/admin/login", "/admin/setup", "/admin/invite"]);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_ADMIN.has(pathname)) return NextResponse.next();

  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  const wantsStaff = pathname.startsWith("/admin");

  if (wantsStaff && session?.kind === "staff") return NextResponse.next();
  if (!wantsStaff && session?.kind === "member") return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = wantsStaff ? "/admin/login" : "/login";
  url.search = "";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}
