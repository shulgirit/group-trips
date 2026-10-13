"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PlaceCard } from "@/components/places/PlaceCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useEvents, usePlaces } from "@/lib/hooks";
import type { Place } from "@/types";
import { useTrip } from "@/components/providers/TripProvider";
import { distanceMeters, formatDistance, useMyLocation } from "@/lib/location";

const FILTERS = [
  { id: "all", label: "הכל" },
  { id: "near", label: "📍 קרוב אליי" },
  { id: "attractions", label: "אטרקציות" },
  { id: "food", label: "אוכל" },
  { id: "beach", label: "חופים" },
  { id: "shopping", label: "קניות" },
  { id: "unscheduled", label: "לא שובץ" },
  { id: "scheduled", label: "שובץ" },
  { id: "favorites", label: "מועדפים" },
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="kicker text-terra-500">{trip.kicker}</p>
          <h1 className="font-display text-3xl font-bold text-ink-900">
            מקומות
          </h1>
        </div>
        <Link href={`${prefix}/places/new`} className="btn-accent px-4 py-2.5 text-sm">
          + הוסף מקום
        </Link>
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="חיפוש מקום…"
        className="field"
        aria-label="חיפוש מקום"
      />

      <div className="no-scrollbar -mx-4 overflow-x-auto px-4">
        <div className="flex w-max gap-2 pb-1">
          {FILTERS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setFilter(id);
                if (id === "near" && locationStatus !== "on") startLocation();
              }}
              className={`chip ${filter === id ? "chip-active" : ""}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {filter === "near" && !fix && (
        <p className="rounded-2xl bg-sea-100/60 px-4 py-3 text-sm text-ink-700">
          {locationStatus === "denied"
            ? "אין הרשאת מיקום — אפשרו אותה בהגדרות הטלפון כדי למיין לפי מרחק"
            : locationStatus === "unavailable"
              ? "לא הצלחנו לאתר את המיקום שלכם"
              : "📍 מאתרים את המיקום שלכם…"}
        </p>
      )}

      {loading ? (
        <ListSkeleton rows={4} />
      ) : error ? (
        <EmptyState
          emoji="😕"
          title="לא הצלחנו לטעון את המקומות"
          description="בדקו את החיבור לרשת ונסו שוב"
        />
      ) : visiblePlaces.length === 0 ? (
        <EmptyState
          emoji="📍"
          title={places?.length ? "אין תוצאות לסינון הזה" : "עוד אין מקומות שמורים"}
          description={
            places?.length
              ? "נסו סינון או חיפוש אחר"
              : "הוסיפו את האטרקציה, המסעדה או החוף הראשונים שלנו"
          }
          action={
            !places?.length && (
              <Link
                href={`${prefix}/places/new`}
                className="btn-primary px-5 py-2.5 text-sm"
              >
                + הוסף מקום ראשון
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
