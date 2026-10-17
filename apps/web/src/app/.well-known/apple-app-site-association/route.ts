import { NextResponse } from "next/server";

/**
 * iOS universal links. Needs APPLE_TEAM_ID (Apple Developer → Membership); until
 * it is set the file is simply absent (404) rather than shipping a placeholder.
 * togehter.app is the dev domain: dev builds use the .dev bundle id.
 */
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const team = process.env.APPLE_TEAM_ID;
  if (!team) return new NextResponse("Not found", { status: 404 });
  const dev = new URL(request.url).hostname === "togehter.app";
  const appID = `${team}.app.together.trips${dev ? ".dev" : ""}`;
  return NextResponse.json(
    { applinks: { details: [{ appIDs: [appID], components: [{ "/": "/j/*" }, { "/": "/t/*" }] }] } },
    { headers: { "Cache-Control": "public, max-age=3600" } }
  );
}
