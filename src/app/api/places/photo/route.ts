import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { authorizeTrip } from "@/lib/server/auth";
import { geocodePlace } from "@/lib/server/import-place";

/**
 * Backfills a real photo for a saved place (or a trip's cover) from Google
 * Places, once. Any member may trigger it; the result is shared with the
 * whole trip. Misses are remembered for a week so we don't pay to ask again.
 */
const RETRY_MS = 7 * 24 * 60 * 60 * 1000;

const RequestSchema = z.union([
  z.object({ tripId: z.string().min(1), placeId: z.string().min(1) }),
  z.object({ tripId: z.string().min(1), cover: z.literal(true) }),
]);

export async function POST(request: Request) {
  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const body = parsed.data;

  const access = await authorizeTrip(request, body.tripId);
  if (access instanceof NextResponse) return access;
  const { trip, doc } = access;
  const now = Date.now();

  if ("cover" in body) {
    if (trip.legacy || !doc) return NextResponse.json({ imageUrl: trip.heroImage ?? null });
    const ref = adminDb().doc(`trips/${body.tripId}`);
    const snapshot = await ref.get();
    const data = snapshot.data() ?? {};
    if (data.coverImage) return NextResponse.json({ imageUrl: data.coverImage });
    if (typeof data.coverTriedAt === "number" && now - data.coverTriedAt < RETRY_MS) {
      return NextResponse.json({ imageUrl: null });
    }
    const stop = trip.stops[0];
    const geo = await geocodePlace(stop?.label ?? trip.name, "");
    await ref.set(geo?.photoUrl ? { coverImage: geo.photoUrl } : { coverTriedAt: now }, { merge: true });
    return NextResponse.json({ imageUrl: geo?.photoUrl ?? null });
  }

  const ref = adminDb().doc(`${trip.path}/places/${body.placeId}`);
  const snapshot = await ref.get();
  if (!snapshot.exists) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const place = snapshot.data() as {
    name?: string;
    area?: string;
    imageUrl?: string | null;
    lat?: number | null;
    photoTriedAt?: number;
  };
  if (place.imageUrl) return NextResponse.json({ imageUrl: place.imageUrl });
  if (typeof place.photoTriedAt === "number" && now - place.photoTriedAt < RETRY_MS) {
    return NextResponse.json({ imageUrl: null });
  }

  const query = [place.name, place.area].filter(Boolean).join(" ");
  const geo = await geocodePlace(query, trip.searchRegionHint);
  const update: Record<string, unknown> = { photoTriedAt: now };
  if (geo?.photoUrl) update.imageUrl = geo.photoUrl;
  if (geo && place.lat == null) {
    update.lat = geo.lat;
    update.lng = geo.lng;
  }
  await ref.update(update);
  return NextResponse.json({ imageUrl: geo?.photoUrl ?? null });
}
