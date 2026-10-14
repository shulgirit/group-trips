"use client";

import { Suspense, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CalendarDays,
  Compass,
  Map as MapIcon,
  Plus,
  Pencil,
  Split,
  Trash2,
  TriangleAlert,
  Users,
} from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { CategoryIcon, Glyph, STROKE } from "@/components/ui/Icon";
import { useDayLabel, useT } from "@/i18n";
import { deleteEvent } from "@/lib/db";
import { useEvents, useFamilies, usePlaces } from "@/lib/hooks";
import { googleMapsUrl, wazeUrl } from "@/lib/nav";
import { participantsIntersect, participantsLabel } from "@/lib/participants";
import { todayIso, tripDayNumber, tripDays } from "@/lib/trip";
import type { Family, TripEvent } from "@/types";
import { useTrip } from "@/components/providers/TripProvider";
import { stopForDay } from "@/lib/trip-doc";

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

function CalendarContent() {
  const { prefix } = useTrip();
  const trip = useTrip();
  const t = useT();
  const formatDayLabel = useDayLabel();
  const days = tripDays(trip);
  const today = todayIso();
  // Push notifications deep-link here with ?day=YYYY-MM-DD
  const requestedDay = useSearchParams().get("day");
  const [selectedDay, setSelectedDay] = useState(
    requestedDay && days.includes(requestedDay)
      ? requestedDay
      : days.includes(today)
        ? today
        : days[0]
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
  const dayNumber = tripDayNumber(selectedDay, trip);
  const multiStop = trip.stops.length > 1;
  const selectedStop = stopForDay(trip.stops, selectedDay);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <p className="kicker text-ink-500">{t("trip.calendar.kicker")}</p>
          <h1 className="mt-1 font-display text-3xl font-light text-ink-900">
            {t("trip.calendar.title")}
          </h1>
        </div>
        <Link
          href={`${prefix}/calendar/new?day=${selectedDay}`}
          className="btn-primary px-4 py-2.5 text-sm"
        >
          <Plus size={16} strokeWidth={STROKE} aria-hidden />
          {t("trip.calendar.addEvent")}
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
              className={`flex min-w-[62px] flex-col items-center whitespace-nowrap rounded-xl border px-3 py-2 transition ${
                selectedDay === day
                  ? "border-sea-900 bg-sea-900 text-cream-50"
                  : day === today
                    ? "border-lemon-400 bg-white text-ink-900"
                    : "border-cream-200 bg-white text-ink-500"
              }`}
            >
              <span className="text-[11px] opacity-75">
                {t("trip.calendar.dayN", { n: index + 1 })}
              </span>
              <span dir="ltr" className="numerals text-sm">
                {formatDayLabel(day).split("· ")[1]}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <p className="text-sm text-ink-500">
          {formatDayLabel(selectedDay)}
          {dayNumber
            ? ` · ${t("trip.calendar.dayOf", { day: dayNumber, total: days.length })}`
            : ""}
          {multiStop ? ` · ${selectedStop.label}` : ""}
          {selectedDay === today ? ` · ${t("common.today")}` : ""}
        </p>
        {hasSplit && (
          <span className="flex items-center gap-1 rounded-full border border-lemon-300 px-2.5 py-1 text-xs font-medium text-ink-700">
            <Split size={12} strokeWidth={STROKE} aria-hidden />
            {t("trip.calendar.split")}
          </span>
        )}
      </div>

      {loading ? (
        <ListSkeleton rows={3} />
      ) : dayEvents.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={t("trip.calendar.emptyTitle")}
          description={t("trip.calendar.emptyDescription")}
          action={
            <Link href={`${prefix}/places`} className="btn-primary px-5 py-2.5 text-sm">
              {t("trip.calendar.pickPlace")}
            </Link>
          }
        />
      ) : (
        <ol className="relative space-y-3 border-e border-cream-200 pe-5">
          {dayEvents.map((event) => {
            const place = event.placeId
              ? places?.find((p) => p.id === event.placeId)
              : null;
            const flag = flags.get(event.id);
            return (
              <li key={event.id} className="relative">
                {/* Timeline dot */}
                <span
                  aria-hidden
                  className={`absolute -end-[28.5px] top-6 flex h-4 w-4 items-center justify-center rounded-full border-2 border-cream-50 ${
                    flag?.conflict
                      ? "bg-terra-500"
                      : flag?.split
                        ? "bg-lemon-400"
                        : "bg-sea-700"
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
                    href={`${prefix}/calendar/${event.id}`}
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
                        <div className="flex h-full items-center justify-center bg-cream-100 text-sea-700">
                          {place ? (
                            <CategoryIcon category={place.category} size={22} />
                          ) : (
                            <Glyph value={event.emoji} fallback={CalendarDays} size={22} />
                          )}
                        </div>
                      )}
                    </div>
                    {/* Content */}
                    <div className="min-w-0 flex-1 px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 truncate text-lg font-normal text-ink-900">
                          {event.title}
                        </p>
                        <div className="text-end">
                          <p
                            dir="ltr"
                            className="numerals text-xl text-sea-700"
                          >
                            {event.startTime}
                          </p>
                          {event.durationMin && (
                            <p className="text-[11px] text-ink-300">
                              {event.durationMin >= 60
                                ? t("trip.units.hoursShort", { value: +(event.durationMin / 60).toFixed(1) })
                                : t("trip.units.minutesShort", { value: event.durationMin })}
                            </p>
                          )}
                        </div>
                      </div>
                      {families && (
                        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-500">
                          <Users size={13} strokeWidth={STROKE} aria-hidden />
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
                          <TriangleAlert size={13} strokeWidth={STROKE} aria-hidden />
                          {t("trip.calendar.conflict")}
                        </p>
                      )}
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-ink-300">
                        <Pencil size={10} strokeWidth={STROKE} aria-hidden />
                        {t("trip.calendar.tapToEdit")}
                      </p>
                    </div>
                  </Link>

                  {/* Actions */}
                  <div className="flex items-center gap-2 border-t border-cream-200 px-3 py-2">
                    {place && (
                      <>
                        <a
                          href={wazeUrl(place)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-soft gap-1.5 px-3 py-1.5 text-sm text-sea-700"
                        >
                          <Compass size={14} strokeWidth={STROKE} aria-hidden />
                          {t("trip.home.navigate")}
                        </a>
                        <a
                          href={googleMapsUrl(place)}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Google Maps"
                          className="btn-soft px-2.5 py-1.5"
                        >
                          <MapIcon size={14} strokeWidth={STROKE} aria-hidden />
                        </a>
                        <Link
                          href={`${prefix}/places/${place.id}`}
                          className="btn-soft px-3 py-1.5 text-sm"
                        >
                          {t("trip.home.details")}
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
                          {t("common.delete")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingId(null)}
                          className="btn-soft px-3 py-1.5 text-sm"
                        >
                          {t("common.cancel")}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeletingId(event.id)}
                        aria-label={t("trip.calendar.deleteEvent")}
                        className="px-2 text-ink-300"
                      >
                        <Trash2 size={16} strokeWidth={STROKE} aria-hidden />
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

export default function CalendarPage() {
  return (
    <Suspense fallback={null}>
      <CalendarContent />
    </Suspense>
  );
}
