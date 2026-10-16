"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CalendarDays,
  Compass,
  Map as MapIcon,
  Plus,
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
import type { Family, Place, TripEvent } from "@/types";
import { usePlacePhoto } from "@/lib/place-photo";
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

/** Place photo (fetched once if missing) or the event's own glyph. */
function EventThumb({ tripId, place, emoji }: { tripId: string; place: Place | null; emoji?: string }) {
  usePlacePhoto(tripId, place);
  return (
    <div className="relative h-[84px] w-[84px] shrink-0 overflow-hidden rounded-xl">
      {place?.imageUrl ? (
        <Image src={place.imageUrl} alt="" fill sizes="84px" className="object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center bg-cream-100 text-route-700">
          {place ? (
            <CategoryIcon category={place.category} size={24} />
          ) : (
            <Glyph value={emoji} fallback={CalendarDays} size={24} />
          )}
        </div>
      )}
    </div>
  );
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
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const interval = setInterval(tick, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, []);

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
              <span className="text-xs opacity-75">
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
        <ol>
          {dayEvents.map((event, index) => {
            const place = event.placeId
              ? places?.find((p) => p.id === event.placeId)
              : null;
            const flag = flags.get(event.id);
            const region = stopForDay(trip.stops, event.day).region;
            const last = index === dayEvents.length - 1;
            const past =
              now !== null &&
              event.day === today &&
              toMinutes(event.startTime) + (event.durationMin ?? DEFAULT_DURATION_MIN) <
                now.getHours() * 60 + now.getMinutes();
            return (
              <li key={event.id} className={`relative flex gap-3 ${past ? "opacity-60" : ""}`}>
                {/* time + route spine */}
                <div className="flex w-14 shrink-0 flex-col items-center">
                  <p dir="ltr" className="font-display text-xl leading-none text-ink-900 tabular-nums">
                    {event.startTime}
                  </p>
                  {event.durationMin ? (
                    <p className="mt-1 text-xs text-ink-400">
                      {event.durationMin >= 60
                        ? t("trip.units.hoursShort", { value: +(event.durationMin / 60).toFixed(1) })
                        : t("trip.units.minutesShort", { value: event.durationMin })}
                    </p>
                  ) : null}
                  <span
                    aria-hidden
                    className={`mt-2 h-3 w-3 shrink-0 rounded-full ${
                      flag?.conflict
                        ? "bg-terra-500"
                        : flag?.split
                          ? "bg-brass-500"
                          : past
                            ? "bg-route-500"
                            : "border-2 border-route-500 bg-white"
                    }`}
                  />
                  {!last && <span aria-hidden className="mt-1 w-px flex-1 bg-route-300" />}
                </div>

                <div
                  className={`mb-4 min-w-0 flex-1 overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgb(15_27_45/0.05),0_10px_28px_-22px_rgb(15_27_45/0.45)] ${
                    flag?.conflict ? "ring-1 ring-terra-400" : flag?.split ? "ring-1 ring-brass-300" : ""
                  }`}
                >
                  <Link
                    href={`${prefix}/calendar/${event.id}`}
                    className="flex items-stretch gap-3 p-3 transition active:bg-cream-100/60"
                  >
                    <div className="min-w-0 flex-1 py-0.5 ps-1">
                      <p dir="auto" className="truncate text-[17px] font-medium text-ink-900">
                        {event.title}
                      </p>
                      {place && (
                        <p dir="auto" className="mt-0.5 truncate text-sm text-ink-500">
                          {place.name}
                        </p>
                      )}
                      {families && (
                        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-ink-500">
                          <Users size={14} strokeWidth={STROKE} aria-hidden className="shrink-0" />
                          <span className="truncate">{participantsLabel(event.participants, families)}</span>
                        </p>
                      )}
                      {event.notes && (
                        <p dir="auto" className="mt-1 line-clamp-2 text-sm text-ink-700">
                          {event.notes}
                        </p>
                      )}
                      {flag?.conflict && (
                        <p className="mt-1.5 flex items-center gap-1 text-sm font-medium text-terra-600">
                          <TriangleAlert size={14} strokeWidth={STROKE} aria-hidden />
                          {t("trip.calendar.conflict")}
                        </p>
                      )}
                    </div>
                    <EventThumb tripId={trip.id} place={place ?? null} emoji={event.emoji} />
                  </Link>

                  {(
                    <div className="flex items-center gap-2 border-t border-cream-100 px-3 py-2">
                      {place && (
                        <a
                          href={wazeUrl(place, region)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-full bg-route-100 px-3 py-1.5 text-sm font-medium text-route-700"
                        >
                          <Compass size={15} strokeWidth={STROKE} aria-hidden />
                          {t("trip.home.navigate")}
                        </a>
                      )}
                      {place && (
                        <a
                          href={googleMapsUrl(place, region)}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Google Maps"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-500"
                        >
                          <MapIcon size={15} strokeWidth={STROKE} aria-hidden />
                        </a>
                      )}
                      {event.createdByName && (
                        <span dir="auto" className="ms-1 truncate text-xs text-ink-400">
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
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-300"
                        >
                          <Trash2 size={15} strokeWidth={STROKE} aria-hidden />
                        </button>
                      )}
                    </div>
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

export default function CalendarPage() {
  return (
    <Suspense fallback={null}>
      <CalendarContent />
    </Suspense>
  );
}
