import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

/**
 * Self-serve surfaces authenticate in the client (Firebase Auth) and are
 * protected by Firestore rules + per-route authorizeTrip(), so the proxy
 * lets them through. Legacy trips stay behind the trip_session cookie.
 */
const PUBLIC_PAGE_PREFIXES = [
  "/welcome",
  "/trips",
  "/new",
  "/t/",
  "/j/",
  "/privacy",
  "/terms",
  "/account",
];

/** Public API: invite preview is shown before sign-in. */
const PUBLIC_API_PREFIXES = ["/api/invites/preview"];

function startsWithAny(pathname: string, prefixes: string[]) {
  return prefixes.some(
    (prefix) =>
      pathname === prefix.replace(/\/$/, "") || pathname.startsWith(prefix)
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (startsWithAny(pathname, PUBLIC_PAGE_PREFIXES)) return NextResponse.next();
  if (startsWithAny(pathname, PUBLIC_API_PREFIXES)) return NextResponse.next();

  // Scheduled reminders (GitHub Actions) — the route checks the secret
  if (
    pathname === "/api/push/check-reminders" &&
    request.headers.has("x-cron-secret")
  ) {
    return NextResponse.next();
  }

  // Bearer-authenticated API calls — every route verifies the token and
  // trip membership itself (src/lib/server/auth.ts).
  if (
    pathname.startsWith("/api/") &&
    /^Bearer\s+\S+/i.test(request.headers.get("authorization") ?? "")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (verifySessionToken(token)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // New visitors land on the product welcome; legacy trip links keep
  // going to their own gates.
  const gateUrl = request.nextUrl.clone();
  gateUrl.pathname =
    pathname === "/"
      ? "/welcome"
      : pathname.startsWith("/sardinia")
        ? "/sardinia/gate"
        : "/gate";
  gateUrl.search = "";
  return NextResponse.redirect(gateUrl);
}

export const config = {
  // Everything is private except the gate screens, the login endpoints,
  // Next.js internals and PWA/static assets.
  matcher: [
    "/((?!gate|sardinia/gate|sardinia/manifest\\.webmanifest|sardinia/apple-icon|api/auth/login|api/auth/session|api/auth/kid-login|_next|favicon\\.ico|icons/|images/|brand/|globe/|sw\\.js|manifest\\.webmanifest|apple-icon|\\.well-known/).*)",
  ],
};
