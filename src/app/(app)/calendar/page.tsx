"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Compass,
  Map as MapIcon,
  Pencil,
  Split,
  Trash2,
  TriangleAlert,
  Users,
} from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { deleteEvent } from "@/lib/db";
import { useEvents, useFamilies, usePlaces } from "@/lib/hooks";
import { googleMapsUrl, wazeUrl } from "@/lib/nav";
import { participantsIntersect, participantsLabel } from "@/lib/participants";
import { formatDayLabel, todayIso, tripDayNumber, tripDays } from "@/lib/trip";
import { PLACE_CATEGORIES, type Family, type TripEvent } from "@/types";

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

function analyzeDay(dayEvents: TripEvent[], families: Family[]) {
  const flags = new Map<string, { split: boolean; conflict: boolean }>();
  for (const event of dayEvents)
    flags.set(event.id, { split: false, conflict: false });
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
        <div>
          <p className="kicker text-terra-500">המסע שלנו</p>
          <h1 className="font-display text-3xl font-bold text-ink-900">
            לוח הטיול
          </h1>
        </div>
        <Link
          href={`/calendar/new?day=${selectedDay}`}
          className="btn-accent px-4 py-2.5 text-sm"
        >
          + אירוע
        </Link>
      </div>

      {/* Day selector */}
      <div className="no-scrollbar -mx-4 overflow-x-auto px-4">
        <div className="flex w-max gap-2 pb-1">
          {days.map((day, index) => (
            <button
              key={day}
              type="button"
              onClick={() => setSelectedDay(day)}
              className={`flex min-w-[62px] flex-col items-center whitespace-nowrap rounded-2xl px-3 py-2 transition ${
                selectedDay === day
                  ? "bg-sea-700 text-cream-50 shadow-sm"
                  : day === today
                    ? "bg-lemon-100 text-ink-900"
                    : "bg-white text-ink-500 border border-cream-200"
              }`}
            >
              <span className="text-[11px] opacity-75">יום {index + 1}</span>
              <span dir="ltr" className="text-sm font-bold tabular-nums">
                {formatDayLabel(day).split("· ")[1]}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <p className="text-sm text-ink-500">
          {formatDayLabel(selectedDay)}
          {dayNumber ? ` · יום ${dayNumber} מתוך ${days.length}` : ""}
          {selectedDay === today ? " · היום 🌞" : ""}
        </p>
        {hasSplit && (
          <span className="flex items-center gap-1 rounded-full bg-lemon-100 px-2.5 py-1 text-xs font-semibold text-ink-700">
            <Split size={12} />
            הקבוצה מתפצלת
          </span>
        )}
      </div>

      {loading ? (
        <ListSkeleton rows={3} />
      ) : dayEvents.length === 0 ? (
        <EmptyState
          emoji="🌊"
          title="יום פנוי לגמרי"
          description="אפשר לשבץ מקום מתוך ׳מקומות׳ או להוסיף אירוע חופשי"
          action={
            <Link href="/places" className="btn-primary px-5 py-2.5 text-sm">
              לבחור מקום
            </Link>
          }
        />
      ) : (
        <ol className="relative space-y-3 border-e-2 border-cream-200 pe-5">
          {dayEvents.map((event) => {
            const place = event.placeId
              ? places?.find((p) => p.id === event.placeId)
              : null;
            const flag = flags.get(event.id);
            const categoryEmoji = place
              ? (PLACE_CATEGORIES[place.category]?.emoji ?? "📌")
              : (event.emoji ?? "•");
            return (
              <li key={event.id} className="relative">
                {/* Timeline dot */}
                <span
                  aria-hidden
                  className={`absolute -end-[27px] top-6 flex h-4 w-4 items-center justify-center rounded-full border-2 border-cream-50 ${
                    flag?.conflict
                      ? "bg-terra-500"
                      : flag?.split
                        ? "bg-lemon-400"
                        : "bg-sea-500"
                  }`}
                />
                <div
                  className={`card overflow-hidden ${
                    flag?.conflict
                      ? "border-terra-400"
                      : flag?.split
                        ? "border-lemon-300"
                        : ""
                  }`}
                >
                  <Link
                    href={`/calendar/${event.id}`}
                    className="flex items-stretch transition active:bg-cream-100/60"
                  >
                    {/* Visual side */}
                    <div className="relative w-20 shrink-0">
                      {place?.imageUrl ? (
                        <Image
                          src={place.imageUrl}
                          alt=""
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-gradient-to-b from-sea-100 to-cream-100 text-2xl">
                          {categoryEmoji}
                        </div>
                      )}
                    </div>
                    {/* Content */}
                    <div className="min-w-0 flex-1 px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 truncate text-lg font-semibold text-ink-900">
                          {event.title}
                        </p>
                        <div className="text-left">
                          <p
                            dir="ltr"
                            className="font-display text-xl font-bold tabular-nums text-sea-700"
                          >
                            {event.startTime}
                          </p>
                          {event.durationMin && (
                            <p className="text-[11px] text-ink-300">
                              {event.durationMin >= 60
                                ? `${+(event.durationMin / 60).toFixed(1)} ש׳`
                                : `${event.durationMin} דק׳`}
                            </p>
                          )}
                        </div>
                      </div>
                      {families && (
                        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-500">
                          <Users size={13} />
                          <span className="truncate">
                            {participantsLabel(event.participants, families)}
                          </span>
                        </p>
                      )}
                      {event.notes && (
                        <p className="mt-1 truncate text-sm text-ink-500">
                          {event.notes}
                        </p>
                      )}
                      {flag?.conflict && (
                        <p className="mt-1 flex items-center gap-1 text-sm font-medium text-terra-600">
                          <TriangleAlert size={13} />
                          התנגשות — אותם משתתפים בשני אירועים
                        </p>
                      )}
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-ink-300">
                        <Pencil size={10} />
                        לחצו לעריכה
                      </p>
                    </div>
                  </Link>

                  {/* Actions */}
                  <div className="flex items-center gap-2 border-t border-cream-100 px-3 py-2">
                    {place && (
                      <>
                        <a
                          href={wazeUrl(place)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-soft gap-1.5 px-3 py-1.5 text-sm text-sea-700"
                        >
                          <Compass size={14} />
                          נווט
                        </a>
                        <a
                          href={googleMapsUrl(place)}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Google Maps"
                          className="btn-soft px-2.5 py-1.5"
                        >
                          <MapIcon size={14} />
                        </a>
                        <Link
                          href={`/places/${place.id}`}
                          className="btn-soft px-3 py-1.5 text-sm"
                        >
                          פרטים
                        </Link>
                      </>
                    )}
                    {event.createdByName && (
                      <span className="ms-1 truncate text-[11px] text-ink-300">
                        {event.createdByName}
                      </span>
                    )}
                    <span className="flex-1" />
                    {deletingId === event.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => deleteEvent(event.id)}
                          className="btn bg-terra-600 px-3 py-1.5 text-sm text-cream-50"
                        >
                          למחוק
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingId(null)}
                          className="btn-soft px-3 py-1.5 text-sm"
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
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
