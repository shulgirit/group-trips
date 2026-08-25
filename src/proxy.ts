import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

export function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (verifySessionToken(token)) {
    return NextResponse.next();
  }

  // Send each trip's visitors to its own gate
  const gateUrl = request.nextUrl.clone();
  gateUrl.pathname = request.nextUrl.pathname.startsWith("/sardinia")
    ? "/sardinia/gate"
    : "/gate";
  gateUrl.search = "";
  return NextResponse.redirect(gateUrl);
}

export const config = {
  // Everything is private except the gate screens, the login endpoints,
  // Next.js internals and PWA/static assets.
  matcher: [
    "/((?!gate|sardinia/gate|sardinia/manifest\\.webmanifest|api/auth/login|api/auth/session|api/auth/kid-login|_next|favicon\\.ico|icons/|images/|sw\\.js|manifest\\.webmanifest|apple-icon).*)",
  ],
};
