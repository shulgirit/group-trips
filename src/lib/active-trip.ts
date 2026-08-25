"use client";

import { DEFAULT_TRIP, type TripConfig } from "@/lib/trips";

/**
 * Module-global active trip for non-React code paths (src/lib/db.ts's
 * plain async functions, called from event handlers). Set by
 * TripProvider before any user interaction can happen; defaults to
 * sicily so legacy behavior is unchanged.
 */
let active: TripConfig = DEFAULT_TRIP;

export function setActiveTrip(trip: TripConfig) {
  active = trip;
}

export function activeTrip(): TripConfig {
  return active;
}

export function activeTripPath(): string {
  return active.path;
}
