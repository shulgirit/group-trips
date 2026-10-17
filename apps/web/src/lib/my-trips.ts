"use client";

import { api } from "@together/backend/api";
import { itineraryName, tripPhase, type TripStatus } from "@together/shared/trip-doc";
import { todayIso } from "@together/shared/trip";
import { useQuery } from "convex/react";
import { useMemo } from "react";

export interface TripSummary {
  id: string;
  href: string;
  name: string;
  emoji: string;
  destination: string;
  startDate: string;
  endDate: string;
  coverImage: string | null;
  status: TripStatus;
  phase: "upcoming" | "live" | "past";
  legacy: boolean;
  /** The signed-in person organizes it (may delete it) */
  isOwner?: boolean;
}

const PHASE_ORDER = { live: 0, upcoming: 1, past: 2 } as const;

export function sortTrips(trips: TripSummary[]): TripSummary[] {
  return [...trips].sort((a, b) => {
    const draftA = a.status === "draft" ? 1 : 0;
    const draftB = b.status === "draft" ? 1 : 0;
    if (a.phase !== b.phase && a.status !== "draft" && b.status !== "draft")
      return PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase];
    if (draftA !== draftB) return draftA - draftB;
    return a.phase === "past"
      ? b.startDate.localeCompare(a.startDate)
      : a.startDate.localeCompare(b.startDate);
  });
}

/** All trips the signed-in user belongs to (realtime). */
export function useMyTrips(uid: string | null) {
  const rows = useQuery(api.trips.mine, uid ? {} : "skip");
  const trips = useMemo(() => {
    const today = todayIso();
    return sortTrips(
      (rows ?? []).map((row) => ({
        id: row.id,
        href: `/t/${row.id}`,
        name: row.name,
        emoji: row.emoji,
        destination: itineraryName(row.stops.map((label) => ({ label }))),
        startDate: row.startDate,
        endDate: row.endDate,
        coverImage: row.coverImage,
        status: row.status,
        phase: tripPhase(row, today),
        legacy: false,
        isOwner: row.isOwner,
      }))
    );
  }, [rows]);
  return { trips, loading: Boolean(uid) && rows === undefined };
}
