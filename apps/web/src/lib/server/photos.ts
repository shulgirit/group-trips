import "server-only";

import { adminDb } from "@/lib/firebase/admin";
import { geocodePlace } from "@/lib/server/import-place";

/** Misses are remembered for a week so we don't pay Google to ask again. */
export const PHOTO_RETRY_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Gives a self-serve trip its destination photo (Google Places) once.
 * Returns the cover URL, or null when there is none (yet).
 */
export async function ensureTripCover(tripId: string, query: string): Promise<string | null> {
  const ref = adminDb().doc(`trips/${tripId}`);
  const snapshot = await ref.get();
  const data = snapshot.data() ?? {};
  if (data.coverImage) return String(data.coverImage);
  if (typeof data.coverTriedAt === "number" && Date.now() - data.coverTriedAt < PHOTO_RETRY_MS) {
    return null;
  }
  const geo = await geocodePlace(query, "");
  await ref.set(geo?.photoUrl ? { coverImage: geo.photoUrl } : { coverTriedAt: Date.now() }, {
    merge: true,
  });
  return geo?.photoUrl ?? null;
}
