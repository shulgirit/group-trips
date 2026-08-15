"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BedDouble,
  Binoculars,
  FerrisWheel,
  Home,
  IceCreamCone,
  MapPin as MapPinIcon,
  ShoppingBag,
  ShoppingCart,
  SquareParking,
  Utensils,
  Volleyball,
  Waves,
  type LucideIcon,
} from "lucide-react";
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
  { id: "scheduled", label: "בלוח" },
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
    case "scheduled":
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

/* Branded vector map pins — pin silhouette in the category color with a
   clean white icon, replacing the default red pin + emoji. */
const CATEGORY_MARKER: Record<
  PlaceCategory,
  { color: string; Icon: LucideIcon }
> = {
  attraction: { color: "#1e81a3", Icon: FerrisWheel },
  restaurant: { color: "#bf653c", Icon: Utensils },
  beach: { color: "#47a5c4", Icon: Waves },
  icecream: { color: "#dfae38", Icon: IceCreamCone },
  shopping: { color: "#a5502d", Icon: ShoppingBag },
  supermarket: { color: "#757d4d", Icon: ShoppingCart },
  viewpoint: { color: "#c9932a", Icon: Binoculars },
  parking: { color: "#0f4f6b", Icon: SquareParking },
  accommodation: { color: "#5c7d54", Icon: BedDouble },
  sport: { color: "#14627f", Icon: Volleyball },
  other: { color: "#776d5c", Icon: MapPinIcon },
};

function markerIconFor(category: PlaceCategory, isVilla: boolean) {
  const { color, Icon } = isVilla
    ? { color: "#b05a38", Icon: Home }
    : (CATEGORY_MARKER[category] ?? CATEGORY_MARKER.other);
  const glyph = renderToStaticMarkup(
    <Icon size={14} color="#ffffff" strokeWidth={2.4} />
  ).replace("<svg", '<svg x="10" y="8.5"');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="44" viewBox="0 0 34 44"><path d="M17 42.5C17 42.5 3.5 25.5 3.5 15.5A13.5 13.5 0 1 1 30.5 15.5C30.5 25.5 17 42.5 17 42.5Z" fill="${color}" stroke="#fbf8f1" stroke-width="2.4"/>${glyph}</svg>`;
  const size = isVilla ? { w: 46, h: 60 } : { w: 34, h: 44 };
  return {
    url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
    scaledSize: new window.google.maps.Size(size.w, size.h),
    anchor: new window.google.maps.Point(size.w / 2, size.h),
  };
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
  const [filter, setFilter] = useState<FilterId>("scheduled");
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
          (filter !== "unscheduled" || !scheduledIds.has(place.id)) &&
          (filter !== "scheduled" || scheduledIds.has(place.id))
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
      // The villa is home base — it gets a bigger terracotta home pin
      const isVilla = place.id === "villa";
      const marker = new window.google.maps.Marker({
        map,
        position: { lat: place.lat, lng: place.lng },
        title: place.name,
        zIndex: isVilla ? 1000 : undefined,
        icon: markerIconFor(place.category, isVilla),
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
      <div>
        <p className="kicker text-terra-500">האי שלנו</p>
        <h1 className="font-display text-3xl font-bold text-ink-900">מפה</h1>
      </div>

      <div className="no-scrollbar -mx-4 overflow-x-auto px-4">
        <div className="flex w-max gap-2 pb-1">
          {FILTERS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`chip ${filter === id ? "chip-active" : ""}`}
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
            <Link href="/places" className="btn-primary px-5 py-2.5 text-sm">
              לרשימת המקומות
            </Link>
          }
        />
      ) : (
        <div className="relative -mx-4 h-[64dvh] overflow-hidden bg-sea-100 md:mx-0 md:rounded-[2rem] md:border md:border-cream-200">
          <div ref={containerRef} className="h-full w-full" />
          {!mapReady && (
            <div className="absolute inset-0 flex items-center justify-center text-ink-500">
              טוען מפה…
            </div>
          )}

          {/* Marker bottom sheet */}
          {selected && (
            <div className="card absolute inset-x-3 bottom-3 overflow-hidden shadow-[var(--shadow-float)]">
              <div className="flex items-stretch">
                <div className="relative w-24 shrink-0">
                  {selected.imageUrl ? (
                    <Image
                      src={selected.imageUrl}
                      alt=""
                      fill
                      sizes="96px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-gradient-to-b from-sea-100 to-cream-100 text-3xl">
                      {selectedCategory?.emoji}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate font-display text-lg font-bold text-ink-900">
                      {selected.name}
                    </p>
                    <button
                      type="button"
                      onClick={() => setSelected(null)}
                      aria-label="סגירה"
                      className="px-1 text-ink-300"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="text-sm text-ink-500">
                    {selectedCategory?.label}
                    {selected.area ? ` · ${selected.area}` : ""}
                    {scheduledIds.has(selected.id) ? " · 📅 בלוח" : ""}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <a
                      href={wazeUrl(selected)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary flex-1 py-2 text-sm"
                    >
                      נווט
                    </a>
                    <a
                      href={googleMapsUrl(selected)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Google Maps"
                      className="btn-soft px-3 py-2 text-sm"
                    >
                      🗺️
                    </a>
                    <Link
                      href={`/places/${selected.id}`}
                      className="btn-soft flex-1 py-2 text-sm"
                    >
                      פרטים
                    </Link>
                  </div>
                </div>
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
