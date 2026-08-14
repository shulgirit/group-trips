"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { deleteEvent } from "@/lib/db";
import { useEvents, useFamilies, usePlaces } from "@/lib/hooks";
import { googleMapsUrl, wazeUrl } from "@/lib/nav";
import {
  participantsIntersect,
  participantsLabel,
} from "@/lib/participants";
import { formatDayLabel, todayIso, tripDayNumber, tripDays } from "@/lib/trip";
import type { Family, TripEvent } from "@/types";

const DEFAULT_DURATION_MIN = 90;

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function eventsOverlap(a: TripEvent, b: TripEvent): boolean {
  const startA = toMinutes(a.startTime);
  const endA = startA + (a.durationMin ?? DEFAULT_DURATION_MIN);
  const startB = toMinutes(b.startTime);
  const endB = startB + (b.durationMin ?? DEFAULT_DURATION_MIN);
  return startA < endB && startB < endA;
}

/** For each event: is it part of a group split / a real person conflict? */
function analyzeDay(dayEvents: TripEvent[], families: Family[]) {
  const flags = new Map<string, { split: boolean; conflict: boolean }>();
  for (const event of dayEvents) flags.set(event.id, { split: false, conflict: false });
  for (let i = 0; i < dayEvents.length; i++) {
    for (let j = i + 1; j < dayEvents.length; j++) {
      const a = dayEvents[i];
      const b = dayEvents[j];
      if (!eventsOverlap(a, b)) continue;
      const shared = participantsIntersect(
        a.participants,
        b.participants,
        families
      );
      const key = shared ? "conflict" : "split";
      flags.get(a.id)![key] = true;
      flags.get(b.id)![key] = true;
    }
  }
  return flags;
}

export default function CalendarPage() {
  const days = tripDays();
  const today = todayIso();
  const [selectedDay, setSelectedDay] = useState(
    days.includes(today) ? today : days[0]
  );
  const { events, loading } = useEvents();
  const { places } = usePlaces();
  const { families } = useFamilies();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const dayEvents = useMemo(
    () => (events ?? []).filter((event) => event.day === selectedDay),
    [events, selectedDay]
  );

  const flags = useMemo(
    () => analyzeDay(dayEvents, families ?? []),
    [dayEvents, families]
  );

  const hasSplit = dayEvents.some((e) => flags.get(e.id)?.split);
  const dayNumber = tripDayNumber(selectedDay);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-ink-900">
          לוח הטיול
        </h1>
        <Link
          href={`/calendar/new?day=${selectedDay}`}
          className="rounded-2xl bg-terra-500 px-4 py-2.5 text-sm font-semibold text-cream-50 transition active:scale-[0.98]"
        >
          + אירוע
        </Link>
      </div>

      {/* Day selector */}
      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex w-max gap-2 pb-1">
          {days.map((day, index) => (
            <button
              key={day}
              type="button"
              onClick={() => setSelectedDay(day)}
              className={`flex flex-col items-center whitespace-nowrap rounded-2xl px-3.5 py-2 transition ${
                selectedDay === day
                  ? "bg-sea-600 text-cream-50"
                  : day === today
                    ? "bg-lemon-100 text-ink-900"
                    : "bg-cream-100 text-ink-500"
              }`}
            >
              <span className="text-xs opacity-80">יום {index + 1}</span>
              <span className="text-sm font-semibold">
                {formatDayLabel(day).split("· ")[1]}
              </span>
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm text-ink-500">
        {formatDayLabel(selectedDay)}
        {dayNumber ? ` · יום ${dayNumber} מתוך ${days.length}` : ""}
        {selectedDay === today ? " · היום 🌞" : ""}
      </p>

      {hasSplit && (
        <p className="rounded-2xl bg-lemon-100 px-4 py-2.5 text-sm font-medium text-ink-700">
          🔀 הקבוצה מתפצלת ביום הזה
        </p>
      )}

      {loading ? (
        <ListSkeleton rows={3} />
      ) : dayEvents.length === 0 ? (
        <EmptyState
          emoji="🌊"
          title="יום פנוי לגמרי"
          description="אפשר לשבץ מקום מתוך ׳מקומות׳ או להוסיף אירוע חופשי"
          action={
            <Link
              href="/places"
              className="inline-block rounded-2xl bg-sea-600 px-5 py-2.5 text-sm font-semibold text-cream-50"
            >
              לבחור מקום
            </Link>
          }
        />
      ) : (
        <ol className="space-y-3">
          {dayEvents.map((event) => {
            const place = event.placeId
              ? places?.find((p) => p.id === event.placeId)
              : null;
            const flag = flags.get(event.id);
            return (
              <li
                key={event.id}
                className={`rounded-3xl border bg-white p-4 ${
                  flag?.conflict
                    ? "border-terra-400"
                    : flag?.split
                      ? "border-lemon-400"
                      : "border-cream-200"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-lg font-semibold text-ink-900">
                      {event.emoji ? `${event.emoji} ` : ""}
                      {event.title}
                    </p>
                    <p className="mt-0.5 text-sm text-ink-500">
                      {families
                        ? `👥 ${participantsLabel(event.participants, families)}`
                        : ""}
                    </p>
                    {event.notes && (
                      <p className="mt-1 text-sm text-ink-500">
                        📝 {event.notes}
                      </p>
                    )}
                    {event.createdByName && (
                      <p className="mt-1 text-xs text-ink-300">
                        נוסף ע״י {event.createdByName}
                      </p>
                    )}
                    {flag?.conflict && (
                      <p className="mt-1 text-sm font-medium text-terra-600">
                        ⚠️ התנגשות — אותם משתתפים בשני אירועים
                      </p>
                    )}
                  </div>
                  <div className="text-left">
                    <p className="text-xl font-bold tabular-nums text-sea-700">
                      {event.startTime}
                    </p>
                    {event.durationMin && (
                      <p className="text-xs text-ink-500">
                        {event.durationMin >= 60
                          ? `${+(event.durationMin / 60).toFixed(1)} ש׳`
                          : `${event.durationMin} דק׳`}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  {place && (
                    <>
                      <a
                        href={wazeUrl(place)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-xl bg-sea-100 px-3.5 py-2 text-sm font-medium text-sea-700"
                      >
                        🧭 נווט
                      </a>
                      <a
                        href={googleMapsUrl(place)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-xl bg-cream-100 px-3.5 py-2 text-sm font-medium text-ink-700"
                      >
                        🗺️
                      </a>
                      <Link
                        href={`/places/${place.id}`}
                        className="rounded-xl bg-cream-100 px-3.5 py-2 text-sm font-medium text-ink-700"
                      >
                        פרטים
                      </Link>
                    </>
                  )}
                  <span className="flex-1" />
                  {deletingId === event.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => deleteEvent(event.id)}
                        className="rounded-xl bg-terra-600 px-3 py-2 text-sm font-semibold text-cream-50"
                      >
                        למחוק
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingId(null)}
                        className="rounded-xl bg-cream-100 px-3 py-2 text-sm text-ink-700"
                      >
                        ביטול
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDeletingId(event.id)}
                      aria-label="מחיקת אירוע"
                      className="px-2 text-ink-300"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
