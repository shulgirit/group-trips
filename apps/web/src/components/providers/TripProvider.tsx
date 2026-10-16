"use client";

import { createContext, useContext, useEffect } from "react";
import { setActiveTrip } from "@/lib/active-trip";
import { DEFAULT_TRIP, TRIPS, type TripConfig, type TripKey } from "@together/shared/trips";

const TripContext = createContext<TripConfig>(DEFAULT_TRIP);

/** Supplies the active trip — a legacy key, or a config built from a trip doc. */
export function TripProvider({
  tripKey,
  config,
  children,
}: {
  tripKey?: TripKey;
  config?: TripConfig;
  children: React.ReactNode;
}) {
  const trip = config ?? TRIPS[tripKey ?? "sicily"];
  // Also set during render so the global is right before first paint
  setActiveTrip(trip);
  useEffect(() => {
    setActiveTrip(trip);
  }, [trip]);
  return <TripContext.Provider value={trip}>{children}</TripContext.Provider>;
}

export function useTrip(): TripConfig {
  return useContext(TripContext);
}
