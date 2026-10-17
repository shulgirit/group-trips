import type { Place } from "@together/shared/types";

export interface Fix {
  lat: number;
  lng: number;
}

/** Great-circle distance in meters. */
export function distanceMeters(a: Fix, b: Fix): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

export const hasCoords = (place: Pick<Place, "lat" | "lng">): place is { lat: number; lng: number } =>
  typeof place.lat === "number" && typeof place.lng === "number";

/** Place fields → Convex args: drops render-only keys and undefined (Convex rejects undefined). */
export function placeArgs<T extends Record<string, unknown>>(input: T) {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || key === "id" || key === "createdAt" || key === "createdByUid" || key === "createdByName") continue;
    out[key] = value;
  }
  return out;
}
