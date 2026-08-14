"use client";

import { use, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SchedulePlaceSheet } from "@/components/events/SchedulePlaceSheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { addOptionToGlobalPoll, deletePlace, updatePlace } from "@/lib/db";
import { useEvents, usePlace } from "@/lib/hooks";
import { googleMapsUrl, wazeUrl } from "@/lib/nav";
import { formatDayLabel } from "@/lib/trip";
import { PLACE_CATEGORIES } from "@/types";

export default function PlaceDetailPage({
  params,
}: {
  params: Promise<{ placeId: string }>;
}) {
  const { placeId } = use(params);
  const router = useRouter();
  const { place, loading } = usePlace(placeId);
  const { events } = useEvents();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pollState, setPollState] = useState<"idle" | "adding" | "added">(
    "idle"
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-52 w-full rounded-3xl" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-24 w-full rounded-3xl" />
      </div>
    );
  }

  if (!place) {
    return (
      <EmptyState
        emoji="🤷"
        title="המקום לא נמצא"
        description="אולי הוא נמחק"
        action={
          <Link
            href="/places"
            className="inline-block rounded-2xl bg-sea-600 px-5 py-2.5 text-sm font-semibold text-cream-50"
          >
            לכל המקומות
          </Link>
        }
      />
    );
  }

  const category = PLACE_CATEGORIES[place.category] ?? PLACE_CATEGORIES.other;
  const placeEvents = (events ?? []).filter((e) => e.placeId === place.id);

  const detailRows = [
    place.address && { label: "📍 כתובת", value: place.address },
    place.openingHours && { label: "🕒 שעות פתיחה", value: place.openingHours },
    place.priceNotes && { label: "💶 מחיר", value: place.priceNotes },
    place.recommendedDurationMin && {
      label: "⏱️ זמן מומלץ",
      value: `כ-${Math.round(place.recommendedDurationMin / 60)} שעות`,
    },
    place.tips && { label: "💡 טיפים", value: place.tips },
    place.popularDishes && {
      label: "🍽️ מנות מומלצות",
      value: place.popularDishes,
    },
    place.reviewsSummary && {
      label: "⭐ מה אומרים בביקורות",
      value: place.reviewsSummary,
    },
  ].filter(Boolean) as { label: string; value: string }[];

  async function handleDelete() {
    await deletePlace(placeId);
    router.replace("/places");
  }

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="relative -mx-4 -mt-4 h-56 overflow-hidden bg-gradient-to-br from-sea-500 to-sea-800">
        {place.imageUrl ? (
          <Image
            src={place.imageUrl}
            alt={place.name}
            fill
            sizes="(max-width: 512px) 100vw, 512px"
            className="object-cover"
            priority
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-7xl opacity-80">
            {category.emoji}
          </span>
        )}
        <button
          type="button"
          onClick={() => updatePlace(placeId, { favorite: !place.favorite })}
          aria-label={place.favorite ? "הסר ממועדפים" : "הוסף למועדפים"}
          className="absolute left-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-cream-50/90 text-xl backdrop-blur"
        >
          {place.favorite ? "❤️" : "🤍"}
        </button>
      </div>

      <div>
        <h1 className="font-display text-3xl font-bold text-ink-900">
          {place.name}
        </h1>
        <p className="mt-1 text-ink-500">
          {category.emoji} {category.label}
          {place.area ? ` · ${place.area}` : ""}
        </p>
      </div>

      {/* Primary actions */}
      <div className="grid grid-cols-2 gap-2">
        <a
          href={wazeUrl(place)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-2xl bg-sea-600 py-3.5 font-semibold text-cream-50 transition active:scale-[0.98]"
        >
          🧭 נווט ב-Waze
        </a>
        <button
          type="button"
          onClick={() => setScheduleOpen(true)}
          className="flex items-center justify-center gap-2 rounded-2xl bg-terra-500 py-3.5 font-semibold text-cream-50 transition active:scale-[0.98]"
        >
          📅 הוסף ללוח
        </button>
      </div>
      <button
        type="button"
        onClick={async () => {
          if (pollState !== "idle") return;
          setPollState("adding");
          try {
            await addOptionToGlobalPoll(place.name, place.id);
            setPollState("added");
          } catch {
            setPollState("idle");
          }
        }}
        disabled={pollState !== "idle"}
        className={`w-full rounded-2xl border py-3 font-medium transition ${
          pollState === "added"
            ? "border-lemon-300 bg-lemon-100 text-ink-700"
            : "border-sea-200 text-sea-700 active:scale-[0.99]"
        }`}
      >
        {pollState === "added"
          ? "🗳️ בסקר הקבוצתי ✓"
          : pollState === "adding"
            ? "מוסיף…"
            : "🗳️ הוסף לסקר הקבוצתי"}
      </button>
      <a
        href={googleMapsUrl(place)}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-center text-sm font-medium text-sea-600"
      >
        או פתחו ב-Google Maps ›
      </a>

      {place.summary && (
        <p className="rounded-3xl bg-cream-100 px-4 py-4 leading-relaxed text-ink-700">
          {place.summary}
        </p>
      )}

      {detailRows.length > 0 && (
        <div className="divide-y divide-cream-200 rounded-3xl border border-cream-200 bg-white">
          {detailRows.map(({ label, value }) => (
            <div key={label} className="px-4 py-3">
              <p className="text-sm font-medium text-ink-500">{label}</p>
              <p className="mt-0.5 text-ink-900">{value}</p>
            </div>
          ))}
        </div>
      )}

      {(place.website || place.bookingUrl) && (
        <div className="flex gap-2">
          {place.website && (
            <a
              href={place.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 rounded-2xl border border-sea-200 py-3 text-center font-medium text-sea-700"
            >
              🌐 אתר רשמי
            </a>
          )}
          {place.bookingUrl && (
            <a
              href={place.bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 rounded-2xl border border-sea-200 py-3 text-center font-medium text-sea-700"
            >
              🎟️ הזמנת כרטיסים
            </a>
          )}
        </div>
      )}

      {/* Scheduled events */}
      {placeEvents.length > 0 && (
        <div>
          <h2 className="mb-2 font-display text-lg font-bold text-ink-900">
            בלוח שלנו
          </h2>
          <ul className="space-y-2">
            {placeEvents.map((event) => (
              <li
                key={event.id}
                className="flex items-center justify-between rounded-2xl bg-sea-100 px-4 py-3"
              >
                <span className="font-medium text-sea-700">
                  {formatDayLabel(event.day)}
                </span>
                <span className="font-semibold tabular-nums text-sea-700">
                  {event.startTime}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Delete */}
      <div className="pt-2 text-center">
        {confirmDelete ? (
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleDelete}
              className="rounded-2xl bg-terra-600 px-5 py-2.5 text-sm font-semibold text-cream-50"
            >
              כן, למחוק
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="rounded-2xl bg-cream-100 px-5 py-2.5 text-sm font-medium text-ink-700"
            >
              ביטול
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="text-sm text-ink-300"
          >
            מחיקת המקום
          </button>
        )}
      </div>

      <SchedulePlaceSheet
        place={place}
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
      />
    </div>
  );
}
