"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { useEvents, usePlaces } from "@/lib/hooks";
import { googleMapsUrl, wazeUrl } from "@/lib/nav";
import { PLACE_CATEGORIES, type Place, type PlaceCategory } from "@/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    google?: any;
    __initTripMap?: () => void;
  }
}

const SICILY_CENTER = { lat: 37.55, lng: 14.25 };

const FILTERS = [
  { id: "all", label: "הכל" },
  { id: "attractions", label: "אטרקציות" },
  { id: "food", label: "אוכל" },
  { id: "beach", label: "חופים" },
  { id: "stay", label: "לינה" },
  { id: "unscheduled", label: "לא שובץ" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

function categoryMatches(category: PlaceCategory, filter: FilterId): boolean {
  switch (filter) {
    case "all":
    case "unscheduled":
      return true;
    case "attractions":
      return ["attraction", "viewpoint"].includes(category);
    case "food":
      return ["restaurant", "icecream"].includes(category);
    case "beach":
      return category === "beach";
    case "stay":
      return category === "accommodation";
  }
}

function loadGoogleMaps(onReady: () => void): void {
  if (window.google?.maps) {
    onReady();
    return;
  }
  const existing = document.getElementById("gmaps-script");
  if (existing) {
    window.__initTripMap = onReady;
    return;
  }
  window.__initTripMap = onReady;
  const script = document.createElement("script");
  script.id = "gmaps-script";
  script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&callback=__initTripMap&language=he&region=IT`;
  script.async = true;
  document.head.appendChild(script);
}

export default function MapPage() {
  const { places, loading } = usePlaces();
  const { events } = useEvents();
  const [filter, setFilter] = useState<FilterId>("all");
  const [mapReady, setMapReady] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const [selected, setSelected] = useState<Place | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const boundsRef = useRef<any>(null);

  const scheduledIds = useMemo(
    () =>
      new Set(
        (events ?? [])
          .map((e) => e.placeId)
          .filter((id): id is string => Boolean(id))
      ),
    [events]
  );

  const mappablePlaces = useMemo(
    () =>
      (places ?? []).filter(
        (place) =>
          typeof place.lat === "number" &&
          typeof place.lng === "number" &&
          categoryMatches(place.category, filter) &&
          (filter !== "unscheduled" || !scheduledIds.has(place.id))
      ),
    [places, filter, scheduledIds]
  );

  const missingCoordsCount = useMemo(
    () =>
      (places ?? []).filter(
        (p) => typeof p.lat !== "number" || typeof p.lng !== "number"
      ).length,
    [places]
  );

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
      setMapFailed(true);
      return;
    }
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (!window.google?.maps && !cancelled) setMapFailed(true);
    }, 10_000);
    loadGoogleMaps(() => {
      if (cancelled) return;
      clearTimeout(timeout);
      setMapReady(true);
    });
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, []);

  const renderMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map || !window.google?.maps) return;
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = mappablePlaces.map((place) => {
      // The villa is home base — it gets a big, distinct terracotta pin
      const isVilla = place.id === "villa";
      const marker = new window.google.maps.Marker({
        map,
        position: { lat: place.lat, lng: place.lng },
        title: place.name,
        zIndex: isVilla ? 1000 : undefined,
        label: {
          text: PLACE_CATEGORIES[place.category]?.emoji ?? "📌",
          fontSize: isVilla ? "22px" : "16px",
        },
        icon: isVilla
          ? {
              path: "M 0,0 C -2,-20 -10,-22 -10,-30 A 10,10 0 1,1 10,-30 C 10,-22 2,-20 0,0 z",
              fillColor: "#b05a38",
              fillOpacity: 1,
              strokeColor: "#fbf8f1",
              strokeWeight: 2.5,
              scale: 1.6,
              labelOrigin: new window.google.maps.Point(0, -30),
            }
          : undefined,
      });
      marker.addListener("click", () => setSelected(place));
      return marker;
    });

    if (mappablePlaces.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      mappablePlaces.forEach((p) =>
        bounds.extend({ lat: p.lat!, lng: p.lng! })
      );
      boundsRef.current = bounds;
      map.fitBounds(bounds, 60);
      if (mappablePlaces.length === 1) map.setZoom(13);
    }
  }, [mappablePlaces]);

  useEffect(() => {
    if (!mapReady || !containerRef.current) return;
    if (!mapRef.current) {
      mapRef.current = new window.google.maps.Map(containerRef.current, {
        center: SICILY_CENTER,
        zoom: 8,
        disableDefaultUI: true,
        zoomControl: true,
        clickableIcons: false,
      });
      mapRef.current.addListener("click", () => setSelected(null));
    }
    renderMarkers();

    // The container can change size after init (fonts/layout settling,
    // rotation) — retile and re-fit so markers stay centered.
    const observer = new ResizeObserver(() => {
      const map = mapRef.current;
      if (!map || !window.google?.maps) return;
      window.google.maps.event.trigger(map, "resize");
      if (boundsRef.current) map.fitBounds(boundsRef.current, 60);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [mapReady, renderMarkers]);

  const selectedCategory = selected
    ? (PLACE_CATEGORIES[selected.category] ?? PLACE_CATEGORIES.other)
    : null;

  return (
    <div className="space-y-3">
      <h1 className="font-display text-2xl font-bold text-ink-900">מפה</h1>

      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex w-max gap-2 pb-1">
          {FILTERS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
                filter === id
                  ? "bg-sea-600 text-cream-50"
                  : "bg-cream-100 text-ink-500"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {mapFailed ? (
        <EmptyState
          emoji="🗺️"
          title="המפה לא נטענה"
          description="עדיין אפשר לנווט לכל מקום מתוך דף המקום עצמו"
          action={
            <Link
              href="/places"
              className="inline-block rounded-2xl bg-sea-600 px-5 py-2.5 text-sm font-semibold text-cream-50"
            >
              לרשימת המקומות
            </Link>
          }
        />
      ) : (
        <div className="relative -mx-4 h-[60dvh] overflow-hidden bg-sea-100">
          <div ref={containerRef} className="h-full w-full" />
          {!mapReady && (
            <div className="absolute inset-0 flex items-center justify-center text-ink-500">
              טוען מפה…
            </div>
          )}

          {/* Marker bottom card */}
          {selected && (
            <div className="absolute inset-x-3 bottom-3 rounded-3xl bg-white p-4 shadow-xl">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-ink-900">
                    {selectedCategory?.emoji} {selected.name}
                  </p>
                  <p className="text-sm text-ink-500">
                    {selectedCategory?.label}
                    {selected.area ? ` · ${selected.area}` : ""}
                    {scheduledIds.has(selected.id) ? " · 📅 בלוח" : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  aria-label="סגירה"
                  className="px-1 text-ink-300"
                >
                  ✕
                </button>
              </div>
              <div className="mt-3 flex gap-2">
                <a
                  href={wazeUrl(selected)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 rounded-2xl bg-sea-600 py-2.5 text-center text-sm font-semibold text-cream-50"
                >
                  🧭 נווט
                </a>
                <a
                  href={googleMapsUrl(selected)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Google Maps"
                  className="rounded-2xl bg-cream-100 px-3.5 py-2.5 text-sm font-medium text-ink-700"
                >
                  🗺️
                </a>
                <Link
                  href={`/places/${selected.id}`}
                  className="flex-1 rounded-2xl bg-cream-100 py-2.5 text-center text-sm font-semibold text-ink-700"
                >
                  פרטים
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {!loading && missingCoordsCount > 0 && (
        <p className="text-sm text-ink-500">
          📍 {missingCoordsCount} מקומות בלי מיקום מדויק עדיין — הם לא מוצגים על
          המפה, אבל הניווט אליהם עובד מדף המקום
        </p>
      )}
    </div>
  );
}
