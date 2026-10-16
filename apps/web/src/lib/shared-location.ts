"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { deleteDoc, doc, setDoc } from "firebase/firestore";
import { useFirebase } from "@/components/providers/FirebaseProvider";
import { useTrip } from "@/components/providers/TripProvider";
import { db } from "@/lib/firebase/client";
import { useCollectionData } from "@/lib/hooks";
import type { Fix } from "@/lib/location";
import type { TKey } from "@/i18n";

/** A member's opt-in, time-boxed live location (trips/{id}/locations/{uid}). */
export interface SharedLocation {
  id: string;
  name: string;
  familyId: string | null;
  lat: number;
  lng: number;
  accuracy: number;
  updatedAt: number;
  expiresAt: number;
}

export const SHARE_DURATIONS = [
  { id: "1h", labelKey: "trip.share.durations.1h", ms: 60 * 60_000 },
  { id: "4h", labelKey: "trip.share.durations.4h", ms: 4 * 60 * 60_000 },
  { id: "day", labelKey: "trip.share.durations.day", ms: 0 },
] as const satisfies readonly { id: string; labelKey: TKey; ms: number }[];

function endOfDay(): number {
  const end = new Date();
  end.setHours(23, 59, 0, 0);
  return end.getTime();
}

const WRITE_EVERY_MS = 30_000;

/**
 * Everyone's live dots + controls for sharing my own. While sharing, my
 * position is written at most every 30s; it expires on its own.
 */
export function useSharedLocations(fix: Fix | null) {
  const trip = useTrip();
  const { user, profile } = useFirebase();
  const { data } = useCollectionData<SharedLocation>(`${trip.path}/locations`);
  const [now, setNow] = useState(() => Date.now());
  const lastWrite = useRef(0);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const mine = data?.find((l) => l.id === user?.uid && l.expiresAt > now) ?? null;
  const others = useMemo(
    () => (data ?? []).filter((l) => l.id !== user?.uid && l.expiresAt > now),
    [data, user?.uid, now]
  );

  const sharing = Boolean(mine);
  const expiresAt = mine?.expiresAt ?? null;

  // Keep my dot fresh while sharing
  useEffect(() => {
    if (!sharing || !fix || !user || !expiresAt) return;
    if (Date.now() - lastWrite.current < WRITE_EVERY_MS) return;
    lastWrite.current = Date.now();
    setDoc(doc(db(), `${trip.path}/locations/${user.uid}`), {
      name: profile?.displayName || user.displayName || "",
      familyId: profile?.familyId ?? null,
      lat: fix.lat,
      lng: fix.lng,
      accuracy: Math.round(fix.accuracy),
      updatedAt: Date.now(),
      expiresAt,
    }).catch(() => undefined);
  }, [sharing, fix, user, profile, trip.path, expiresAt]);

  async function startSharing(durationId: (typeof SHARE_DURATIONS)[number]["id"], current: Fix) {
    if (!user) return;
    const option = SHARE_DURATIONS.find((d) => d.id === durationId)!;
    lastWrite.current = Date.now();
    await setDoc(doc(db(), `${trip.path}/locations/${user.uid}`), {
      name: profile?.displayName || user.displayName || "",
      familyId: profile?.familyId ?? null,
      lat: current.lat,
      lng: current.lng,
      accuracy: Math.round(current.accuracy),
      updatedAt: Date.now(),
      expiresAt: option.ms ? Date.now() + option.ms : endOfDay(),
    });
  }

  async function stopSharing() {
    if (!user) return;
    await deleteDoc(doc(db(), `${trip.path}/locations/${user.uid}`)).catch(() => undefined);
  }

  return { others, sharing, expiresAt, startSharing, stopSharing };
}
