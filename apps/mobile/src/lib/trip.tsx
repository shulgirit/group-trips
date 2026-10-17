import { api } from "@together/backend/api";
import type { Doc, Id } from "@together/backend/dataModel";
import { toEvent, toExpense, toFamily, toPlace, toPoll, toTripDoc } from "@together/backend/shapes";
import { resolveHomeBase } from "@together/shared/home-base";
import { todayIso } from "@together/shared/trip";
import { tripConfigFromDoc } from "@together/shared/trip-doc";
import type { TripConfig } from "@together/shared/trips";
import { useQuery } from "convex/react";
import { createContext, useContext, useMemo } from "react";
import { useLocale } from "./i18n";

/**
 * The open trip: its Convex row, the caller's seat, and the TripConfig view
 * (localized copy, stops, persona) the screens read — the same config the
 * web pages use.
 */
export interface TripState {
  id: Id<"trips">;
  doc: Doc<"trips">;
  me: Doc<"memberships">;
  config: TripConfig;
  avatarUrl: string | null;
  isAdmin: boolean;
  isKid: boolean;
  canDeletePlaces: boolean;
}

const TripContext = createContext<TripState | null>(null);

export function TripProvider({
  value,
  children,
}: {
  value: { trip: Doc<"trips">; me: Doc<"memberships">; avatarUrl: string | null };
  children: React.ReactNode;
}) {
  const { locale } = useLocale();
  const state = useMemo<TripState>(() => {
    const { trip, me, avatarUrl } = value;
    const isAdmin = me.role === "owner" || me.role === "admin";
    return {
      id: trip._id,
      doc: trip,
      me,
      config: tripConfigFromDoc(trip._id, toTripDoc(trip, avatarUrl), locale),
      avatarUrl,
      isAdmin,
      isKid: me.role === "kid",
      canDeletePlaces: isAdmin || (trip.membersCanDeletePlaces && me.role !== "kid" && !me.guest),
    };
  }, [value, locale]);
  return <TripContext.Provider value={state}>{children}</TripContext.Provider>;
}

export function useTrip(): TripState {
  const value = useContext(TripContext);
  if (!value) throw new Error("useTrip outside TripProvider");
  return value;
}

/* Realtime trip data (Convex subscriptions), in the shared render shapes. */

export function usePlaces() {
  const tripId = useTrip().id;
  const rows = useQuery(api.places.list, { tripId });
  return useMemo(() => rows?.map(toPlace).sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)), [rows]);
}

export function usePlace(placeId: string) {
  const tripId = useTrip().id;
  const row = useQuery(api.places.get, { tripId, placeId });
  return row === undefined ? undefined : row ? toPlace(row) : null;
}

export function useEvents() {
  const tripId = useTrip().id;
  const rows = useQuery(api.events.list, { tripId });
  return useMemo(
    () => rows?.map(toEvent).sort((a, b) => (a.day === b.day ? a.startTime.localeCompare(b.startTime) : a.day.localeCompare(b.day))),
    [rows]
  );
}

export function useEvent(eventId: string) {
  const tripId = useTrip().id;
  const row = useQuery(api.events.get, { tripId, eventId });
  return row === undefined ? undefined : row ? toEvent(row) : null;
}

export function useExpenses() {
  const tripId = useTrip().id;
  const rows = useQuery(api.expenses.list, { tripId });
  return useMemo(() => rows?.map(toExpense).sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt ?? 0) - (a.createdAt ?? 0)), [rows]);
}

export function usePolls() {
  const tripId = useTrip().id;
  const rows = useQuery(api.polls.list, { tripId });
  return useMemo(() => rows?.map(toPoll).sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)), [rows]);
}

export function useFamilies() {
  const tripId = useTrip().id;
  const rows = useQuery(api.families.list, { tripId });
  return useMemo(() => rows?.map(toFamily).sort((a, b) => a.order - b.order), [rows]);
}

export function useMembers() {
  const tripId = useTrip().id;
  return useQuery(api.memberships.list, { tripId });
}

/** The home base: the trip's set one, else the stay for today among saved places. */
export function useHomeBase() {
  const places = usePlaces();
  return useMemo(() => (places ? resolveHomeBase(places, todayIso()) : null), [places]);
}
