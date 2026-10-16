"use client";

import { useLocationPrimer } from "@/components/permissions/LocationPrimer";

import { CHART_MAP_STYLE } from "@/lib/map-style";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CalendarCheck,
  Home,
  LocateFixed,
  Map as MapIcon,
  MapPin as MapPinIcon,
  MapPinned,
  Radio,
  X,
} from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { useEvents, usePlaces } from "@/lib/hooks";
import { resolveHomeBase } from "@/lib/home-base";
import { todayIso } from "@/lib/trip";
import { googleMapsUrl, wazeUrl } from "@/lib/nav";
import type { Place, PlaceCategory } from "@/types";
import { useTrip } from "@/components/providers/TripProvider";
import { useFirebase } from "@/components/providers/FirebaseProvider";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useFamilies } from "@/lib/hooks";
import { distanceMeters, formatDistance, useMyLocation } from "@/lib/location";
import { SHARE_DURATIONS, useSharedLocations } from "@/lib/shared-location";
import { CATEGORY_ICON, CategoryIcon, STROKE } from "@/components/ui/Icon";
import { useLocale, useT } from "@/i18n";
import { activeLocale, tActive } from "@/i18n/active";
import { intlLocale } from "@/i18n/format";

const FAMILY_HEX: Record<string, string> = {
  sea: "#3a4c66",
  terra: "#9c5a43",
  lemon: "#a8865a",
  olive: "#5e7f7a",
};

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    google?: any;
    __initTripMap?: () => void;
  }
}



const FILTERS = [
  { id: "scheduled" },
  { id: "all" },
  { id: "attractions" },
  { id: "food" },
  { id: "beach" },
  { id: "stay" },
  { id: "unscheduled" },
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

/* Vector map pins — pin silhouette in a quiet category tone with a clean
   ivory icon (icons shared with the rest of the app via CATEGORY_ICON). */
const CATEGORY_COLOR: Record<PlaceCategory, string> = {
  attraction: "#16243a",
  restaurant: "#9c5a43",
  beach: "#3a4c66",
  icecream: "#a8865a",
  shopping: "#8a4c37",
  supermarket: "#5e7f7a",
  viewpoint: "#a8865a",
  parking: "#6b6a66",
  accommodation: "#5e7f7a",
  sport: "#22324a",
  other: "#6b7a90",
};

function markerIconFor(category: PlaceCategory, isVilla: boolean) {
  const { color, Icon } = isVilla
    ? { color: "#a8865a", Icon: Home }
    : {
        color: CATEGORY_COLOR[category] ?? CATEGORY_COLOR.other,
        Icon: CATEGORY_ICON[category] ?? MapPinIcon,
      };
  const glyph = renderToStaticMarkup(
    <Icon size={14} color="#f7f5f0" strokeWidth={2} />
  ).replace("<svg", '<svg x="10" y="8.5"');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="44" viewBox="0 0 34 44"><path d="M17 42.5C17 42.5 3.5 25.5 3.5 15.5A13.5 13.5 0 1 1 30.5 15.5C30.5 25.5 17 42.5 17 42.5Z" fill="${color}" stroke="#f7f5f0" stroke-width="2"/>${glyph}</svg>`;
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
  script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&callback=__initTripMap&language=${activeLocale()}`;
  script.async = true;
  document.head.appendChild(script);
}

export default function MapPage() {
  const trip = useTrip();
  const { prefix } = trip;
  const t = useT();
  const { locale } = useLocale();
  const { places, loading } = usePlaces();
  // Home pin follows the current hotel (multi-hotel trips switch mid-trip)
  const homeBaseId = useMemo(
    () => (places ? (resolveHomeBase(places, todayIso())?.id ?? null) : null),
    [places]
  );
  const { events } = useEvents();
  // null = automatic: scheduled places when there are any, otherwise all of them
  const [chosenFilter, setFilter] = useState<FilterId | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const [selected, setSelected] = useState<Place | null>(null);
  const { personal } = useFirebase();
  const { families } = useFamilies();
  const { fix, status: locationStatus, start: startLocationNow } = useMyLocation();
  // first time: a short explanation before the system location prompt
  const { request: startLocation, sheet: locationSheet } = useLocationPrimer(startLocationNow);
  const shared = useSharedLocations(fix);
  const [shareOpen, setShareOpen] = useState(false);
  const followRef = useRef(false);
  const meMarkerRef = useRef<any>(null);
  const meCircleRef = useRef<any>(null);
  const othersRef = useRef<any[]>([]);

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
  const filter: FilterId = chosenFilter ?? (scheduledIds.size > 0 ? "scheduled" : "all");

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
      const isVilla = place.id === homeBaseId;
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
  }, [mappablePlaces, homeBaseId]);

  useEffect(() => {
    if (!mapReady || !containerRef.current) return;
    if (!mapRef.current) {
      mapRef.current = new window.google.maps.Map(containerRef.current, {
        center: trip.mapCenter,
        zoom: 8,
        disableDefaultUI: true,
        zoomControl: true,
        styles: CHART_MAP_STYLE,
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

  // Multi-country itinerary: numbered stop pins + a dashed route line
  const stopsRef = useRef<any[]>([]);
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !window.google?.maps || trip.stops.length < 2) return;
    stopsRef.current.forEach((overlay) => overlay.setMap(null));
    const path = trip.stops.map((stop) => ({ lat: stop.lat, lng: stop.lng }));
    stopsRef.current = [
      new window.google.maps.Polyline({
        map,
        path,
        geodesic: true,
        strokeOpacity: 0,
        icons: [
          {
            icon: { path: "M 0,-1 0,1", strokeOpacity: 0.6, strokeColor: "#16243a", scale: 2.5 },
            offset: "0",
            repeat: "14px",
          },
        ],
        clickable: false,
      }),
      ...trip.stops.map(
        (stop, index) =>
          new window.google.maps.Marker({
            map,
            position: { lat: stop.lat, lng: stop.lng },
            zIndex: 500,
            title: `${index + 1}. ${stop.label}`,
            label: { text: String(index + 1), color: "#f7f5f0", fontWeight: "500", fontSize: "12px" },
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 11,
              fillColor: "#0f1b2d",
              fillOpacity: 0.92,
              strokeColor: "#f7f5f0",
              strokeWeight: 2,
            },
          })
      ),
    ];
    // No places yet — show the whole route
    if (!mappablePlaces.length) {
      const bounds = new window.google.maps.LatLngBounds();
      path.forEach((point) => bounds.extend(point));
      boundsRef.current = bounds;
      map.fitBounds(bounds, 60);
    }
  }, [mapReady, trip.stops, mappablePlaces.length]);

  // My live blue dot + accuracy halo
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !fix || !window.google?.maps) return;
    const position = { lat: fix.lat, lng: fix.lng };
    if (!meMarkerRef.current) {
      meMarkerRef.current = new window.google.maps.Marker({
        map,
        position,
        zIndex: 2000,
        title: tActive("trip.map.me"),
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: "#1a73e8",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 3,
        },
      });
      meCircleRef.current = new window.google.maps.Circle({
        map,
        center: position,
        radius: fix.accuracy,
        fillColor: "#1a73e8",
        fillOpacity: 0.12,
        strokeOpacity: 0,
        clickable: false,
      });
    } else {
      meMarkerRef.current.setPosition(position);
      meCircleRef.current?.setCenter(position);
      meCircleRef.current?.setRadius(fix.accuracy);
    }
    if (followRef.current) {
      followRef.current = false;
      map.panTo(position);
      if (map.getZoom() < 14) map.setZoom(15);
    }
  }, [mapReady, fix]);

  // Group members sharing their location
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !window.google?.maps) return;
    othersRef.current.forEach((marker) => marker.setMap(null));
    othersRef.current = shared.others.map((other) => {
      const color =
        FAMILY_HEX[families?.find((f) => f.id === other.familyId)?.color ?? ""] ?? "#3a4c66";
      const minutes = Math.max(0, Math.round((Date.now() - other.updatedAt) / 60_000));
      return new window.google.maps.Marker({
        map,
        position: { lat: other.lat, lng: other.lng },
        zIndex: 1500,
        title: t("trip.map.otherAgo", { name: other.name, minutes }),
        label: {
          text: (other.name || "?").slice(0, 1),
          color: "#ffffff",
          fontWeight: "500",
          fontSize: "13px",
        },
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 13,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 3,
        },
      });
    });
  }, [mapReady, shared.others, families, t]);

  function locateMe() {
    followRef.current = true;
    if (fix && mapRef.current) {
      followRef.current = false;
      mapRef.current.panTo({ lat: fix.lat, lng: fix.lng });
      if (mapRef.current.getZoom() < 14) mapRef.current.setZoom(15);
    }
    if (locationStatus !== "on") startLocation();
  }

  const selectedDistance =
    selected && fix && typeof selected.lat === "number" && typeof selected.lng === "number"
      ? formatDistance(distanceMeters(fix, { lat: selected.lat, lng: selected.lng }))
      : null;


  return (
    <div className="space-y-4">
      {locationSheet}
      <div>
        <p className="kicker text-ink-500">{trip.legacy ? t("trip.map.kickerLegacy") : trip.shortName}</p>
        <h1 className="mt-1 font-display text-3xl font-light text-ink-900">{t("trip.map.title")}</h1>
      </div>

      <div className="no-scrollbar -mx-4 overflow-x-auto px-4">
        <div className="flex w-max gap-2 pb-1">
          {FILTERS.map(({ id }) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`chip ${filter === id ? "chip-active" : ""}`}
            >
              {t(`trip.map.filters.${id}`)}
            </button>
          ))}
        </div>
      </div>

      {mapFailed ? (
        <EmptyState
          icon={MapIcon}
          title={t("trip.map.failedTitle")}
          description={t("trip.map.failedDescription")}
          action={
            <Link href={`${prefix}/places`} className="btn-primary px-5 py-2.5 text-sm">
              {t("trip.map.toPlaces")}
            </Link>
          }
        />
      ) : (
        <div className="relative -mx-4 h-[64dvh] overflow-hidden bg-cream-100 md:mx-0 md:rounded-2xl md:border md:border-cream-200">
          <div ref={containerRef} className="h-full w-full" />
          {!mapReady && (
            <div className="absolute inset-0 flex items-center justify-center text-ink-500">
              {t("trip.map.loading")}
            </div>
          )}

          {/* Location controls */}
          {mapReady && (
            <div className="absolute end-3 top-3 flex flex-col gap-2">
              <button
                type="button"
                onClick={locateMe}
                aria-label={t("trip.map.myLocation")}
                className={`flex h-11 w-11 items-center justify-center rounded-full border border-cream-200 bg-white shadow-[var(--shadow-float)] transition active:scale-95 ${
                  locationStatus === "on" ? "text-[#1a73e8]" : "text-ink-700"
                }`}
              >
                <LocateFixed size={20} strokeWidth={STROKE} aria-hidden className={locationStatus === "asking" ? "animate-pulse" : ""} />
              </button>
              {personal && (
                <button
                  type="button"
                  onClick={() => setShareOpen(true)}
                  aria-label={t("trip.share.aria")}
                  aria-pressed={shared.sharing}
                  className={`flex h-11 w-11 items-center justify-center rounded-full border shadow-[var(--shadow-float)] transition active:scale-95 ${
                    shared.sharing
                      ? "border-sea-900 bg-sea-900 text-lemon-200"
                      : "border-cream-200 bg-white text-ink-700"
                  }`}
                >
                  <Radio size={20} strokeWidth={STROKE} aria-hidden />
                </button>
              )}
            </div>
          )}
          {locationStatus === "denied" && (
            <p className="card absolute inset-x-3 top-3 me-16 px-3 py-2 text-xs text-ink-700">
              {t("trip.map.locationDenied")}
            </p>
          )}
          {shared.others.length > 0 && !selected && (
            <p className="absolute bottom-3 start-3 flex items-center gap-1.5 rounded-full border border-cream-200 bg-white/90 px-3 py-1.5 text-xs text-ink-700 backdrop-blur">
              <Radio size={13} strokeWidth={STROKE} aria-hidden className="text-sea-700" />
              {t("trip.map.othersSharing", {
                names: shared.others.map((o) => o.name.split(" ")[0]).join(", "),
              })}
            </p>
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
                    <div className="flex h-full items-center justify-center bg-cream-100 text-sea-700">
                      <CategoryIcon category={selected.category} size={26} />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate font-display text-lg font-normal text-ink-900">
                      {selected.name}
                    </p>
                    <button
                      type="button"
                      onClick={() => setSelected(null)}
                      aria-label={t("common.close")}
                      className="px-1 text-ink-300"
                    >
                      <X size={16} strokeWidth={STROKE} aria-hidden />
                    </button>
                  </div>
                  <p className="flex flex-wrap items-center gap-x-1 text-sm text-ink-500">
                    <span>{t(`trip.categories.${selected.category}`)}</span>
                    {selected.area ? <span>· {selected.area}</span> : null}
                    {scheduledIds.has(selected.id) ? (
                      <span className="inline-flex items-center gap-1">
                        ·
                        <CalendarCheck size={12} strokeWidth={STROKE} aria-hidden />
                        {t("trip.placeCard.scheduled")}
                      </span>
                    ) : null}
                    {selectedDistance ? (
                      <span>· {t("trip.map.fromYou", { distance: selectedDistance })}</span>
                    ) : null}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <a
                      href={wazeUrl(selected)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary flex-1 py-2 text-sm"
                    >
                      {t("trip.home.navigate")}
                    </a>
                    <a
                      href={googleMapsUrl(selected)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Google Maps"
                      className="btn-outline px-3 py-2 text-sm"
                    >
                      <MapIcon size={16} strokeWidth={STROKE} aria-hidden />
                    </a>
                    <Link
                      href={`${prefix}/places/${selected.id}`}
                      className="btn-outline flex-1 py-2 text-sm"
                    >
                      {t("trip.home.details")}
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <BottomSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title={t("trip.share.title")}
      >
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-ink-500">
            {t("trip.share.description")}
          </p>
          {shared.sharing ? (
            <>
              <p className="rounded-xl border border-lemon-300 px-4 py-3 text-sm text-ink-700">
                {t("trip.share.sharingUntil", {
                  time: new Date(shared.expiresAt!).toLocaleTimeString(intlLocale(locale), {
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                })}
              </p>
              <button
                type="button"
                onClick={() => shared.stopSharing().then(() => setShareOpen(false))}
                className="btn-outline w-full py-3"
              >
                {t("trip.share.stop")}
              </button>
            </>
          ) : !fix ? (
            <button
              type="button"
              onClick={() => {
                followRef.current = true;
                startLocation();
              }}
              className="btn-primary w-full py-3"
            >
              {locationStatus === "asking" ? t("trip.share.locating") : t("trip.share.enableLocation")}
            </button>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {SHARE_DURATIONS.map((duration) => (
                <button
                  key={duration.id}
                  type="button"
                  onClick={() =>
                    shared.startSharing(duration.id, fix).then(() => setShareOpen(false))
                  }
                  className="btn-outline py-3 text-sm"
                >
                  {t(duration.labelKey)}
                </button>
              ))}
            </div>
          )}
        </div>
      </BottomSheet>

      {!loading && missingCoordsCount > 0 && (
        <p className="flex items-start gap-2 text-sm text-ink-500">
          <MapPinned size={16} strokeWidth={STROKE} aria-hidden className="mt-0.5 shrink-0" />
          {t("trip.map.missingCoords", { count: missingCoordsCount })}
        </p>
      )}
    </div>
  );
}
