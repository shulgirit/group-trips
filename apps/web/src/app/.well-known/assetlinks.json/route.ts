import { NextResponse } from "next/server";

/**
 * Android app links. Needs ANDROID_SHA256_CERTS: comma-separated SHA-256 fingerprints
 * (Play Console → App signing, plus the EAS upload key). Absent (404) until set.
 */
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const fingerprints = (process.env.ANDROID_SHA256_CERTS ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  if (!fingerprints.length) return new NextResponse("Not found", { status: 404 });
  const dev = new URL(request.url).hostname === "togehter.app";
  return NextResponse.json(
    [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: { namespace: "android_app", package_name: `app.together.trips${dev ? ".dev" : ""}`, sha256_cert_fingerprints: fingerprints },
      },
    ],
    { headers: { "Cache-Control": "public, max-age=3600" } }
  );
}
