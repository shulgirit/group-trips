"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useFirebase } from "@/components/providers/FirebaseProvider";
import { TRIP_PATH } from "@/lib/trip";
import type { Expense, Family, Place, Poll, TripEvent } from "@/types";

export { TRIP_PATH };

export function useCollectionData<T extends { id: string }>(path: string) {
  const { ready } = useFirebase();
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
  }, [ready, path]);

  return { data, loading: data === null && !error, error };
}

export function useDocData<T>(path: string) {
  const { ready } = useFirebase();
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
  }, [ready, path]);

  return { data, loading: data === undefined && !error, error };
}

export function usePlaces() {
  const { data, ...rest } = useCollectionData<Place>(`${TRIP_PATH}/places`);
  const sorted = useMemo(
    () => data?.slice().sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)),
    [data]
  );
  return { places: sorted ?? null, ...rest };
}

export function usePlace(placeId: string) {
  const { data, ...rest } = useDocData<Place>(`${TRIP_PATH}/places/${placeId}`);
  return { place: data, ...rest };
}

export function useEvents() {
  const { data, ...rest } = useCollectionData<TripEvent>(`${TRIP_PATH}/events`);
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
  const { data, ...rest } = useCollectionData<Expense>(
    `${TRIP_PATH}/expenses`
  );
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
  const { data, ...rest } = useCollectionData<Poll>(`${TRIP_PATH}/polls`);
  const sorted = useMemo(
    () => data?.slice().sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)),
    [data]
  );
  return { polls: sorted ?? null, ...rest };
}

export function useFamilies() {
  const { data, ...rest } = useCollectionData<Family>(`${TRIP_PATH}/families`);
  const sorted = useMemo(
    () => data?.slice().sort((a, b) => a.order - b.order),
    [data]
  );
  return { families: sorted ?? null, ...rest };
}
