"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import {
  itineraryName,
  stopsOf,
  tripPhase,
  type TripDoc,
  type TripStatus,
} from "@/lib/trip-doc";
import { TRIPS } from "@/lib/trips";
import { todayIso } from "@/lib/trip";

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
  ownerUid?: string;
  doc?: TripDoc;
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

/** All trips the signed-in user belongs to — self-serve + legacy. */
export function useMyTrips(uid: string | null) {
  const [tripIds, setTripIds] = useState<string[] | null>(null);
  const [docs, setDocs] = useState<Record<string, TripSummary | null>>({});
  const [legacy, setLegacy] = useState<TripSummary[]>([]);

  useEffect(() => {
    if (!uid) {
      setTripIds(null);
      return;
    }
    return onSnapshot(
      doc(db(), `users/${uid}`),
      (snapshot) => setTripIds((snapshot.data()?.tripIds as string[]) ?? []),
      () => setTripIds([])
    );
  }, [uid]);

  useEffect(() => {
    if (!tripIds) return;
    const today = todayIso();
    const unsubscribers = tripIds.map((id) =>
      onSnapshot(
        doc(db(), `trips/${id}`),
        (snapshot) => {
          const data = snapshot.data() as TripDoc | undefined;
          setDocs((current) => ({
            ...current,
            [id]:
              data && data.destination
                ? {
                    id,
                    href: `/t/${id}`,
                    name: data.name,
                    emoji: data.emoji,
                    destination: itineraryName(stopsOf(data)),
                    startDate: data.startDate,
                    endDate: data.endDate,
                    coverImage: data.coverImage,
                    status: data.status,
                    phase: tripPhase(data, today),
                    legacy: false,
                    ownerUid: data.ownerUid,
                    doc: data,
                  }
                : null,
          }));
        },
        () => setDocs((current) => ({ ...current, [id]: null }))
      )
    );
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [tripIds]);

  // Legacy trips: membership = a profile doc in that trip
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    const today = todayIso();
    Promise.all(
      Object.values(TRIPS).map(async (trip) => {
        try {
          const profile = await getDoc(doc(db(), `${trip.path}/users/${uid}`));
          if (!profile.exists()) return null;
        } catch {
          return null;
        }
        const summary: TripSummary = {
          id: trip.id,
          href: trip.prefix || "/",
          name: trip.name,
          emoji: trip.emoji,
          destination: trip.shortName,
          startDate: trip.startDate,
          endDate: trip.endDate,
          coverImage: trip.heroImage,
          status: "active",
          phase: tripPhase(trip, today),
          legacy: true,
        };
        return summary;
      })
    ).then((found) => {
      if (!cancelled) setLegacy(found.filter((t): t is TripSummary => Boolean(t)));
    });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const loading =
    tripIds === null || tripIds.some((id) => docs[id] === undefined);
  const trips = sortTrips([
    ...Object.values(docs).filter(
      (t): t is TripSummary =>
        Boolean(t) && (tripIds ?? []).includes(t!.id) && t!.status !== "archived"
    ),
    ...legacy.filter((t) => !(tripIds ?? []).includes(t.id)),
  ]);
  return { trips, loading };
}
