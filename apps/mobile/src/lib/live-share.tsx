import { api } from "@together/backend/api";
import { useMutation, useQuery } from "convex/react";
import * as Location from "expo-location";
import { useCallback, useEffect, useMemo, useState } from "react";
import { track } from "@/lib/analytics";
import { useTrip } from "@/lib/trip";

/** How long one share lasts: 1h, 4h, or until the end of the day. Always time-boxed, never open-ended. */
export const SHARE_DURATIONS = [
  { id: "1h", key: "trip.share.durations.1h", ms: 60 * 60_000 },
  { id: "4h", key: "trip.share.durations.4h", ms: 4 * 60 * 60_000 },
  { id: "day", key: "trip.share.durations.day", ms: 0 },
] as const;

const WRITE_EVERY_MS = 30_000;

function endOfDay(): number {
  const end = new Date();
  end.setHours(23, 59, 0, 0);
  return end.getTime();
}

export type StartResult = "ok" | "denied" | "unavailable";

/** Everyone currently sharing in this trip, plus start/stop for me. Foreground only: nothing is sent when the app is closed. */
export function useLiveShare() {
  const { id: tripId } = useTrip();
  const rows = useQuery(api.locations.list, { tripId });
  const share = useMutation(api.locations.share);
  const stopShare = useMutation(api.locations.stop);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const people = useMemo(() => (rows ?? []).filter((row) => row.expiresAt > now), [rows, now]);
  const mine = people.find((row) => row.isMe) ?? null;

  const start = useCallback(
    async (durationId: (typeof SHARE_DURATIONS)[number]["id"]): Promise<StartResult> => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return "denied";
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const choice = SHARE_DURATIONS.find((d) => d.id === durationId) ?? SHARE_DURATIONS[0];
        const expiresAt = choice.ms ? Date.now() + choice.ms : endOfDay();
        await share({ tripId, lat: position.coords.latitude, lng: position.coords.longitude, ...(position.coords.accuracy ? { accuracy: position.coords.accuracy } : {}), expiresAt });
        track("location_share_started", { duration: durationId });
        return "ok";
      } catch {
        return "unavailable";
      }
    },
    [share, tripId]
  );

  const stop = useCallback(async () => {
    await stopShare({ tripId });
    track("location_share_stopped");
  }, [stopShare, tripId]);

  return { people, mine, start, stop };
}

/**
 * Keeps my position fresh while I am sharing and the app is open (a write at most every 30 s). It stops by itself when
 * the chosen time ends or the app closes; there is no background location.
 */
export function LiveShareBridge() {
  const { id: tripId } = useTrip();
  const share = useMutation(api.locations.share);
  const rows = useQuery(api.locations.list, { tripId });
  const expiresAt = rows?.find((row) => row.isMe && row.expiresAt > Date.now())?.expiresAt ?? null;

  useEffect(() => {
    if (!expiresAt) return;
    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;
    void Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, timeInterval: WRITE_EVERY_MS, distanceInterval: 20 }, (position) => {
      if (Date.now() >= expiresAt) return;
      void share({ tripId, lat: position.coords.latitude, lng: position.coords.longitude, ...(position.coords.accuracy ? { accuracy: position.coords.accuracy } : {}), expiresAt }).catch(() => undefined);
    }).then((sub) => {
      if (cancelled) sub.remove();
      else subscription = sub;
    }).catch(() => undefined);
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [expiresAt, share, tripId]);

  return null;
}
