import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { resolveTrip } from "@/lib/server/trip-server";
import { ImportError, importPlaceFromUrl } from "@/lib/server/import-place";

export const maxDuration = 120;

const RequestSchema = z.object({
  url: z.string().url(),
  tripId: z.string().optional(),
});

export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let url: string;
  let tripId: string | undefined;
  try {
    ({ url, tripId } = RequestSchema.parse(await request.json()));
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const draft = await importPlaceFromUrl(
      url,
      resolveTrip(tripId).searchRegionHint
    );
    return NextResponse.json({ draft });
  } catch (error) {
    const reason = error instanceof ImportError ? error.reason : "extract_failed";
    return NextResponse.json({ error: reason }, { status: 502 });
  }
}
