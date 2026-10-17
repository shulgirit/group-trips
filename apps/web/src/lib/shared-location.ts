"use client";

import { api } from "@together/backend/api";
import type { Id } from "@together/backend/dataModel";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTrip } from "@/components/providers/TripProvider";
import type { Fix } from "@/lib/location";
import type { TKey } from "@/i18n";

/** A member's opt-in, time-boxed live location. */
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
  const tripId = useTrip().id as Id<"trips">;
  const rows = useQuery(api.locations.list, { tripId });
  const share = useMutation(api.locations.share);
  const stop = useMutation(api.locations.stop);
  const [now, setNow] = useState(() => Date.now());
  const lastWrite = useRef(0);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const data: (SharedLocation & { isMe: boolean })[] = useMemo(
    () =>
      (rows ?? []).map((row) => ({
        id: row.userId,
        name: row.name,
        familyId: row.familyId,
        lat: row.lat,
        lng: row.lng,
        accuracy: row.accuracy ?? 0,
        updatedAt: row.updatedAt,
        expiresAt: row.expiresAt,
        isMe: row.isMe,
      })),
    [rows]
  );
  const mine = data.find((l) => l.isMe && l.expiresAt > now) ?? null;
  const others = useMemo(() => data.filter((l) => !l.isMe && l.expiresAt > now), [data, now]);

  const sharing = Boolean(mine);
  const expiresAt = mine?.expiresAt ?? null;

  // Keep my dot fresh while sharing
  useEffect(() => {
    if (!sharing || !fix || !expiresAt) return;
    if (Date.now() - lastWrite.current < WRITE_EVERY_MS) return;
    lastWrite.current = Date.now();
    share({ tripId, lat: fix.lat, lng: fix.lng, accuracy: Math.round(fix.accuracy), expiresAt }).catch(() => undefined);
  }, [sharing, fix, tripId, expiresAt, share]);

  async function startSharing(durationId: (typeof SHARE_DURATIONS)[number]["id"], current: Fix) {
    const option = SHARE_DURATIONS.find((d) => d.id === durationId)!;
    lastWrite.current = Date.now();
    await share({
      tripId,
      lat: current.lat,
      lng: current.lng,
      accuracy: Math.round(current.accuracy),
      expiresAt: option.ms ? Date.now() + option.ms : endOfDay(),
    });
  }

  async function stopSharing() {
    await stop({ tripId }).catch(() => undefined);
  }

  return { others, sharing, expiresAt, startSharing, stopSharing };
}
