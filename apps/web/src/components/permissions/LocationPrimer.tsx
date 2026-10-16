"use client";

import { useCallback, useState } from "react";
import { MapPin } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { STROKE } from "@/components/ui/Icon";
import { useT } from "@/i18n";

const EXPLAINED_KEY = "together-location-explained-v1";

function explained(): boolean {
  try {
    return localStorage.getItem(EXPLAINED_KEY) === "1";
  } catch {
    return true;
  }
}

/**
 * Explains location once, before the system prompt appears for the first
 * time (people say yes far more often, and app reviewers expect it).
 * Already-granted or already-explained → straight to the real request.
 */
export function useLocationPrimer(start: () => void) {
  const t = useT();
  const [open, setOpen] = useState(false);

  const request = useCallback(async () => {
    if (explained()) return start();
    try {
      const status = await navigator.permissions?.query({ name: "geolocation" as PermissionName });
      if (status?.state === "granted") return start();
    } catch {
      // permissions API missing (some webviews) — explain first
    }
    setOpen(true);
  }, [start]);

  const allow = () => {
    try {
      localStorage.setItem(EXPLAINED_KEY, "1");
    } catch {
      // ignore
    }
    setOpen(false);
    start();
  };

  const sheet = (
    <BottomSheet open={open} onClose={() => setOpen(false)} title={t("trip.permissions.location.title")}>
      <div className="space-y-5 pb-2">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-route-100 text-route-700">
          <MapPin size={26} strokeWidth={STROKE} aria-hidden />
        </span>
        <p className="text-center leading-relaxed text-ink-700">{t("trip.permissions.location.text")}</p>
        <div className="flex gap-2">
          <button type="button" onClick={allow} className="btn-accent flex-1 py-3.5">
            {t("trip.permissions.location.allow")}
          </button>
          <button type="button" onClick={() => setOpen(false)} className="btn-soft px-5 py-3.5">
            {t("trip.permissions.location.later")}
          </button>
        </div>
      </div>
    </BottomSheet>
  );

  return { request, sheet };
}
