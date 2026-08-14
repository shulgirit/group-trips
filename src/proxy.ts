import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

export function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (verifySessionToken(token)) {
    return NextResponse.next();
  }

  const gateUrl = request.nextUrl.clone();
  gateUrl.pathname = "/gate";
  gateUrl.search = "";
  return NextResponse.redirect(gateUrl);
}

export const config = {
  // Everything is private except the gate screen, the login endpoint,
  // Next.js internals and PWA/static assets.
  matcher: [
    "/((?!gate|api/auth/login|api/auth/session|_next|favicon\\.ico|icons/|images/|sw\\.js|manifest\\.webmanifest|apple-icon).*)",
  ],
};
