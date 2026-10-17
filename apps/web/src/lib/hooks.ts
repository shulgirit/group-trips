"use client";

import { api } from "@together/backend/api";
import type { Id } from "@together/backend/dataModel";
import { resolveHomeBase } from "@together/shared/home-base";
import { todayIso } from "@together/shared/trip";
import { useQuery } from "convex/react";
import { useMemo } from "react";
import { useTrip } from "@/components/providers/TripProvider";
import { toEvent, toExpense, toFamily, toPlace, toPoll } from "@/lib/convex-shapes";

/** Realtime trip data (Convex subscriptions), in the shapes the pages render. */

function useTripId(): Id<"trips"> {
  return useTrip().id as Id<"trips">;
}

const state = <T,>(data: T | undefined) => ({ loading: data === undefined, error: false });

export function usePlaces() {
  const rows = useQuery(api.places.list, { tripId: useTripId() });
  const places = useMemo(() => rows?.map(toPlace).sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)) ?? null, [rows]);
  return { places, ...state(rows) };
}

export function usePlace(placeId: string) {
  const row = useQuery(api.places.get, { tripId: useTripId(), placeId });
  return { place: row === undefined ? undefined : row ? toPlace(row) : null, ...state(row) };
}

export function useEvents() {
  const rows = useQuery(api.events.list, { tripId: useTripId() });
  const events = useMemo(
    () =>
      rows
        ?.map(toEvent)
        .sort((a, b) => (a.day === b.day ? a.startTime.localeCompare(b.startTime) : a.day.localeCompare(b.day))) ?? null,
    [rows]
  );
  return { events, ...state(rows) };
}

export function useEvent(eventId: string) {
  const row = useQuery(api.events.get, { tripId: useTripId(), eventId });
  return { event: row === undefined ? undefined : row ? toEvent(row) : null, ...state(row) };
}

export function useExpenses() {
  const rows = useQuery(api.expenses.list, { tripId: useTripId() });
  const expenses = useMemo(
    () => rows?.map(toExpense).sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt ?? 0) - (a.createdAt ?? 0)) ?? null,
    [rows]
  );
  return { expenses, ...state(rows) };
}

export function usePolls() {
  const rows = useQuery(api.polls.list, { tripId: useTripId() });
  const polls = useMemo(() => rows?.map(toPoll).sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)) ?? null, [rows]);
  return { polls, ...state(rows) };
}

export function useFamilies() {
  const rows = useQuery(api.families.list, { tripId: useTripId() });
  const families = useMemo(() => rows?.map(toFamily).sort((a, b) => a.order - b.order) ?? null, [rows]);
  return { families, ...state(rows) };
}

/** Everyone in the trip (avatars, members list). */
export function useMembers() {
  const rows = useQuery(api.memberships.list, { tripId: useTripId() });
  return { members: rows ?? null, ...state(rows) };
}

/**
 * The trip's "home base": the fixed-id "villa" place when it exists
 * (sicily), otherwise the earliest accommodation-category place — so
 * adding a hotel (e.g. via the AI) lights up the HOME button and the
 * map's home pin automatically.
 */
export function useHomeBase() {
  const { places, ...rest } = usePlaces();
  const home = useMemo(() => (places ? resolveHomeBase(places, todayIso()) : null), [places]);
  return { home, ...rest };
}
