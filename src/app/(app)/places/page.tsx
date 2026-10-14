"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CloudOff, LocateFixed, MapPin, Plus } from "lucide-react";
import { PlaceCard } from "@/components/places/PlaceCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { STROKE } from "@/components/ui/Icon";
import { useT } from "@/i18n";
import { useEvents, usePlaces } from "@/lib/hooks";
import type { Place } from "@/types";
import { useTrip } from "@/components/providers/TripProvider";
import { distanceMeters, formatDistance, useMyLocation } from "@/lib/location";

const FILTERS = [
  { id: "all" },
  { id: "near" },
  { id: "attractions" },
  { id: "food" },
  { id: "beach" },
  { id: "shopping" },
  { id: "unscheduled" },
  { id: "scheduled" },
  { id: "favorites" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

function matchesFilter(
  place: Place,
  filter: FilterId,
  scheduledIds: Set<string>
): boolean {
  switch (filter) {
    case "all":
    case "near":
      return true;
    case "attractions":
      return ["attraction", "viewpoint"].includes(place.category);
    case "food":
      return ["restaurant", "icecream"].includes(place.category);
    case "beach":
      return place.category === "beach";
    case "shopping":
      return ["shopping", "supermarket"].includes(place.category);
    case "unscheduled":
      return !scheduledIds.has(place.id);
    case "scheduled":
      return scheduledIds.has(place.id);
    case "favorites":
      return Boolean(place.favorite);
  }
}

export default function PlacesPage() {
  const trip = useTrip();
  const { prefix } = trip;
  const t = useT();
  const { places, loading, error } = usePlaces();
  const { events } = useEvents();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");
  const { fix, status: locationStatus, start: startLocation } = useMyLocation();

  const scheduledIds = useMemo(
    () =>
      new Set(
        (events ?? [])
          .map((event) => event.placeId)
          .filter((id): id is string => Boolean(id))
      ),
    [events]
  );

  const visiblePlaces = useMemo(() => {
    const term = search.trim();
    const matching = (places ?? []).filter(
      (place) =>
        matchesFilter(place, filter, scheduledIds) &&
        (!term ||
          place.name.includes(term) ||
          place.area?.includes(term) ||
          place.address?.includes(term))
    );
    if (filter !== "near" || !fix) return matching;
    const distance = (place: Place) =>
      typeof place.lat === "number" && typeof place.lng === "number"
        ? distanceMeters(fix, { lat: place.lat, lng: place.lng })
        : Number.POSITIVE_INFINITY;
    return [...matching].sort((a, b) => distance(a) - distance(b));
  }, [places, search, filter, scheduledIds, fix]);

  function distanceLabel(place: Place): string | null {
    if (!fix || typeof place.lat !== "number" || typeof place.lng !== "number")
      return null;
    return formatDistance(distanceMeters(fix, { lat: place.lat, lng: place.lng }));
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <p className="kicker text-ink-500">{trip.kicker}</p>
          <h1 className="mt-1 font-display text-3xl font-light text-ink-900">
            {t("trip.places.title")}
          </h1>
        </div>
        <Link href={`${prefix}/places/new`} className="btn-primary px-4 py-2.5 text-sm">
          <Plus size={16} strokeWidth={STROKE} aria-hidden />
          {t("trip.places.add")}
        </Link>
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("trip.places.searchPlaceholder")}
        className="field"
        aria-label={t("trip.places.searchAria")}
      />

      <div className="no-scrollbar -mx-4 overflow-x-auto px-4">
        <div className="flex w-max gap-2 pb-1">
          {FILTERS.map(({ id }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setFilter(id);
                if (id === "near" && locationStatus !== "on") startLocation();
              }}
              className={`chip ${filter === id ? "chip-active" : ""}`}
            >
              {id === "near" && <LocateFixed size={14} strokeWidth={STROKE} aria-hidden />}
              {t(`trip.places.filters.${id}`)}
            </button>
          ))}
        </div>
      </div>

      {filter === "near" && !fix && (
        <p className="flex items-center gap-2 rounded-xl border border-cream-200 px-4 py-3 text-sm text-ink-700">
          <LocateFixed size={16} strokeWidth={STROKE} aria-hidden className="shrink-0 text-ink-500" />
          {locationStatus === "denied"
            ? t("trip.places.locationDenied")
            : locationStatus === "unavailable"
              ? t("trip.places.locationUnavailable")
              : t("trip.places.locating")}
        </p>
      )}

      {loading ? (
        <ListSkeleton rows={4} />
      ) : error ? (
        <EmptyState
          icon={CloudOff}
          title={t("trip.places.loadErrorTitle")}
          description={t("common.errors.network")}
        />
      ) : visiblePlaces.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title={places?.length ? t("trip.places.noResultsTitle") : t("trip.places.emptyTitle")}
          description={
            places?.length
              ? t("trip.places.noResultsDescription")
              : t("trip.places.emptyDescription")
          }
          action={
            !places?.length && (
              <Link
                href={`${prefix}/places/new`}
                className="btn-primary px-5 py-2.5 text-sm"
              >
                <Plus size={16} strokeWidth={STROKE} aria-hidden />
                {t("trip.places.addFirst")}
              </Link>
            )
          }
        />
      ) : (
        <ul className="space-y-4">
          {visiblePlaces.map((place) => (
            <li key={place.id}>
              <PlaceCard
                place={place}
                scheduled={scheduledIds.has(place.id)}
                distanceLabel={filter === "near" ? distanceLabel(place) : null}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
