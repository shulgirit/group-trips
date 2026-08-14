"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PlaceCard } from "@/components/places/PlaceCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useEvents, usePlaces } from "@/lib/hooks";
import type { Place } from "@/types";

const FILTERS = [
  { id: "all", label: "הכל" },
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
  const { places, loading, error } = usePlaces();
  const { events } = useEvents();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");

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
    return (places ?? []).filter(
      (place) =>
        matchesFilter(place, filter, scheduledIds) &&
        (!term ||
          place.name.includes(term) ||
          place.area?.includes(term) ||
          place.address?.includes(term))
    );
  }, [places, search, filter, scheduledIds]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-ink-900">מקומות</h1>
        <Link
          href="/places/new"
          className="rounded-2xl bg-terra-500 px-4 py-2.5 text-sm font-semibold text-cream-50 transition active:scale-[0.98]"
        >
          + הוסף מקום
        </Link>
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="חיפוש מקום…"
        className="w-full rounded-2xl border border-cream-200 bg-white px-4 py-3 text-ink-900 outline-none transition placeholder:text-ink-300 focus:border-sea-500"
        aria-label="חיפוש מקום"
      />

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
                href="/places/new"
                className="inline-block rounded-2xl bg-sea-600 px-5 py-2.5 text-sm font-semibold text-cream-50"
              >
                + הוסף מקום ראשון
              </Link>
            )
          }
        />
      ) : (
        <ul className="space-y-3">
          {visiblePlaces.map((place) => (
            <li key={place.id}>
              <PlaceCard place={place} scheduled={scheduledIds.has(place.id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
