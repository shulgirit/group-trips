"use client";

import { useEffect } from "react";
import { apiFetch } from "@/lib/firebase/client";

/** Ids already requested in this tab — each place is asked for at most once. */
const requested = new Set<string>();

/**
 * Makes sure a saved place gets its real photo. When the place has none,
 * asks the server once to find it (Google Places); the photo then arrives
 * through the normal Firestore subscription, for everyone in the trip.
 */
export function usePlacePhoto(
  tripId: string,
  place: { id: string; imageUrl?: string | null } | null | undefined
) {
  const placeId = place?.id;
  const missing = Boolean(place && !place.imageUrl);
  useEffect(() => {
    if (!placeId || !missing) return;
    const key = `${tripId}/${placeId}`;
    if (requested.has(key)) return;
    requested.add(key);
    apiFetch("/api/places/photo", {
      method: "POST",
      body: JSON.stringify({ tripId, placeId }),
    }).catch(() => undefined);
  }, [tripId, placeId, missing]);
}

/** Same for a trip's cover photo (self-serve trips without one). */
export function useTripCover(tripId: string, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const key = `${tripId}/cover`;
    if (requested.has(key)) return;
    requested.add(key);
    apiFetch("/api/places/photo", {
      method: "POST",
      body: JSON.stringify({ tripId, cover: true }),
    }).catch(() => undefined);
  }, [tripId, enabled]);
}
