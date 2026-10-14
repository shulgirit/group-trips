import { NextResponse } from "next/server";
import { z } from "zod";
import { enrichSavedPlace } from "@/lib/server/enrich";
import { authorizeTrip } from "@/lib/server/auth";
import { requestLocale } from "@/i18n/server";

export const maxDuration = 120;

const RequestSchema = z.object({
  placeId: z.string().min(1),
  tripId: z.string().optional(),
  url: z
    .string()
    .trim()
    .regex(/^https?:\/\//)
    .optional(),
});

export async function POST(request: Request) {
  let placeId: string;
  let url: string | undefined;
  let tripId: string | undefined;
  try {
    ({ placeId, url, tripId } = RequestSchema.parse(await request.json()));
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const access = await authorizeTrip(request, tripId);
  if (access instanceof NextResponse) return access;
  const trip = access.trip;

  try {
    const result = await enrichSavedPlace(trip, placeId, url, await requestLocale());
    return NextResponse.json(result);
  } catch (error) {
    console.error("[import/enrich]", error);
    return NextResponse.json(
      { ok: false, message: "ההעשרה נכשלה, נסו שוב" },
      { status: 502 }
    );
  }
}
