import { contentLocale } from "@together/i18n/config";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeTrip } from "@/lib/server/auth";
import { requestLocale } from "@/i18n/server";
import { ImportError, importPlaceFromUrl } from "@/lib/server/import-place";

export const maxDuration = 120;

const RequestSchema = z.object({
  url: z.string().url(),
  tripId: z.string().optional(),
});

export async function POST(request: Request) {
  let url: string;
  let tripId: string | undefined;
  try {
    ({ url, tripId } = RequestSchema.parse(await request.json()));
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const access = await authorizeTrip(request, tripId);
  if (access instanceof NextResponse) return access;
  const trip = access.trip;

  try {
    const draft = await importPlaceFromUrl(url, trip.searchRegionHint, contentLocale(await requestLocale()));
    return NextResponse.json({ draft });
  } catch (error) {
    const reason = error instanceof ImportError ? error.reason : "extract_failed";
    return NextResponse.json({ error: reason }, { status: 502 });
  }
}
