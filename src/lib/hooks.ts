"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useFirebase } from "@/components/providers/FirebaseProvider";
import { useTrip } from "@/components/providers/TripProvider";
import { resolveHomeBase } from "@/lib/home-base";
import { todayIso } from "@/lib/trip";
import type { Expense, Family, Place, Poll, TripEvent } from "@/types";

export function useCollectionData<T extends { id: string }>(path: string) {
  const { ready, epoch } = useFirebase();
  const [data, setData] = useState<T[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!ready) return;
    return onSnapshot(
      collection(db(), path),
      (snapshot) => {
        setData(
          snapshot.docs.map(
            (docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as T
          )
        );
        setError(false);
      },
      () => setError(true)
    );
    // epoch bumps after trip membership is provisioned — re-subscribe
  }, [ready, path, epoch]);

  return { data, loading: data === null && !error, error };
}

export function useDocData<T>(path: string) {
  const { ready, epoch } = useFirebase();
  const [data, setData] = useState<T | null | undefined>(undefined);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!ready) return;
    return onSnapshot(
      doc(db(), path),
      (snapshot) => {
        setData(
          snapshot.exists()
            ? ({ id: snapshot.id, ...snapshot.data() } as T)
            : null
        );
        setError(false);
      },
      () => setError(true)
    );
    // epoch bumps after trip membership is provisioned — re-subscribe
  }, [ready, path, epoch]);

  return { data, loading: data === undefined && !error, error };
}

export function usePlaces() {
  const { path } = useTrip();
  const { data, ...rest } = useCollectionData<Place>(`${path}/places`);
  const sorted = useMemo(
    () => data?.slice().sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)),
    [data]
  );
  return { places: sorted ?? null, ...rest };
}

export function usePlace(placeId: string) {
  const { path } = useTrip();
  const { data, ...rest } = useDocData<Place>(`${path}/places/${placeId}`);
  return { place: data, ...rest };
}

export function useEvents() {
  const { path } = useTrip();
  const { data, ...rest } = useCollectionData<TripEvent>(`${path}/events`);
  const sorted = useMemo(
    () =>
      data
        ?.slice()
        .sort((a, b) =>
          a.day === b.day
            ? a.startTime.localeCompare(b.startTime)
            : a.day.localeCompare(b.day)
        ),
    [data]
  );
  return { events: sorted ?? null, ...rest };
}

export function useExpenses() {
  const { path } = useTrip();
  const { data, ...rest } = useCollectionData<Expense>(`${path}/expenses`);
  const sorted = useMemo(
    () =>
      data
        ?.slice()
        .sort(
          (a, b) =>
            b.date.localeCompare(a.date) ||
            (b.createdAt ?? 0) - (a.createdAt ?? 0)
        ),
    [data]
  );
  return { expenses: sorted ?? null, ...rest };
}

export function usePolls() {
  const { path } = useTrip();
  const { data, ...rest } = useCollectionData<Poll>(`${path}/polls`);
  const sorted = useMemo(
    () => data?.slice().sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)),
    [data]
  );
  return { polls: sorted ?? null, ...rest };
}

export function useFamilies() {
  const { path } = useTrip();
  const { data, ...rest } = useCollectionData<Family>(`${path}/families`);
  const sorted = useMemo(
    () => data?.slice().sort((a, b) => a.order - b.order),
    [data]
  );
  return { families: sorted ?? null, ...rest };
}

/**
 * The trip's "home base": the fixed-id "villa" place when it exists
 * (sicily), otherwise the earliest accommodation-category place — so
 * adding a hotel (e.g. via the AI) lights up the HOME button and the
 * map's home pin automatically.
 */
export function useHomeBase() {
  const { places, ...rest } = usePlaces();
  const home = useMemo(
    () => (places ? resolveHomeBase(places, todayIso()) : null),
    [places]
  );
  return { home, ...rest };
}
