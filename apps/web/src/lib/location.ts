"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { tActive } from "@together/i18n/active";

/**
 * Device location — native GPS inside the Capacitor app (better accuracy,
 * proper OS permission prompt), browser geolocation on the web. Foreground
 * only: we never track in the background.
 */

export interface Fix {
  lat: number;
  lng: number;
  accuracy: number;
  at: number;
}

export type LocationStatus = "idle" | "asking" | "on" | "denied" | "unavailable";

/* eslint-disable @typescript-eslint/no-explicit-any */
interface NativeGeolocation {
  checkPermissions(): Promise<{ location: string }>;
  requestPermissions(): Promise<{ location: string }>;
  watchPosition(
    options: { enableHighAccuracy?: boolean; timeout?: number; maximumAge?: number },
    callback: (position: any, err?: any) => void
  ): Promise<string>;
  clearWatch(options: { id: string }): Promise<void>;
}

function nativeGeolocation(): NativeGeolocation | null {
  if (typeof window === "undefined") return null;
  const cap = (window as any).Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  return (
    cap.Plugins?.Geolocation ??
    (typeof cap.registerPlugin === "function" ? cap.registerPlugin("Geolocation") : null)
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function isNativeApp(): boolean {
  return nativeGeolocation() !== null;
}

const REMEMBER_KEY = "location-enabled-v1";

function remembered(): boolean {
  try {
    return localStorage.getItem(REMEMBER_KEY) === "1";
  } catch {
    return false;
  }
}

function remember(on: boolean) {
  try {
    if (on) localStorage.setItem(REMEMBER_KEY, "1");
    else localStorage.removeItem(REMEMBER_KEY);
  } catch {
    // private mode
  }
}

/** Haversine distance in meters. */
export function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(meters: number): string {
  if (meters < 950) return tActive("trip.units.meters", { value: Math.round(meters / 10) * 10 });
  const km = meters / 1000;
  return tActive("trip.units.km", { value: km < 10 ? km.toFixed(1) : Math.round(km) });
}

/**
 * Live position while the component is mounted and the user turned it on.
 * Auto-resumes when the user enabled it before and permission is granted.
 */
export function useMyLocation() {
  const [fix, setFix] = useState<Fix | null>(null);
  const [status, setStatus] = useState<LocationStatus>("idle");
  const stopRef = useRef<(() => void) | null>(null);

  const stop = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    setStatus("idle");
    remember(false);
  }, []);

  const start = useCallback(async () => {
    if (stopRef.current) return;
    setStatus("asking");
    const native = nativeGeolocation();
    const onFix = (lat: number, lng: number, accuracy: number) => {
      setFix({ lat, lng, accuracy, at: Date.now() });
      setStatus("on");
      remember(true);
    };

    if (native) {
      try {
        let permission = await native.checkPermissions();
        if (permission.location !== "granted") {
          permission = await native.requestPermissions();
        }
        if (permission.location !== "granted") {
          setStatus("denied");
          return;
        }
        const id = await native.watchPosition(
          { enableHighAccuracy: true, timeout: 20_000, maximumAge: 5_000 },
          (position, err) => {
            if (err || !position) return;
            onFix(position.coords.latitude, position.coords.longitude, position.coords.accuracy);
          }
        );
        stopRef.current = () => {
          native.clearWatch({ id }).catch(() => undefined);
        };
      } catch {
        setStatus("unavailable");
      }
      return;
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unavailable");
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (position) =>
        onFix(position.coords.latitude, position.coords.longitude, position.coords.accuracy),
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setStatus("denied");
          remember(false);
          stopRef.current?.();
          stopRef.current = null;
        } else if (!stopRef.current) {
          setStatus("unavailable");
        }
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 5_000 }
    );
    stopRef.current = () => navigator.geolocation.clearWatch(id);
  }, []);

  // Resume silently if the user opted in before and the browser still allows it
  useEffect(() => {
    if (!remembered()) return;
    if (nativeGeolocation()) {
      start();
      return;
    }
    navigator.permissions
      ?.query({ name: "geolocation" as PermissionName })
      .then((result) => {
        if (result.state === "granted") start();
      })
      .catch(() => undefined);
  }, [start]);

  useEffect(() => () => stopRef.current?.(), []);

  return { fix, status, start, stop };
}
