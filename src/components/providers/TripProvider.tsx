"use client";

import { createContext, useContext, useEffect } from "react";
import { setActiveTrip } from "@/lib/active-trip";
import { DEFAULT_TRIP, TRIPS, type TripConfig, type TripKey } from "@/lib/trips";

const TripContext = createContext<TripConfig>(DEFAULT_TRIP);

export function TripProvider({
  tripKey,
  children,
}: {
  tripKey: TripKey;
  children: React.ReactNode;
}) {
  const trip = TRIPS[tripKey];
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
