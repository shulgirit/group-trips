import type { Doc } from "../_generated/dataModel";

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in kilometres. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** The trip's own area: the destination and every stop. */
const anchors = (trip: Doc<"trips">) => [{ lat: trip.destination.lat, lng: trip.destination.lng }, ...trip.stops.map((s) => ({ lat: s.lat, lng: s.lng }))];

/** A found location is believable for this trip only if it is within `maxKm` of the destination or a stop (a place edit never moves a pin to another continent). */
export function nearTrip(trip: Doc<"trips">, point: { lat: number; lng: number }, maxKm = 400): boolean {
  return anchors(trip).some((anchor) => distanceKm(anchor, point) <= maxKm);
}

/** Google "location bias" around the trip's destination, so ambiguous names resolve nearby first. */
export const biasOf = (trip: Doc<"trips">) => ({ lat: trip.destination.lat, lng: trip.destination.lng, radiusM: 50_000 });
