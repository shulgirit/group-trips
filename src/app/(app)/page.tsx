"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Countdown } from "@/components/home/Countdown";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useEvents, useFamilies, usePlaces } from "@/lib/hooks";
import { googleMapsUrl, wazeUrl } from "@/lib/nav";
import { participantsLabel } from "@/lib/participants";
import {
  TRIP,
  formatDayLabel,
  todayIso,
  tripDayNumber,
  tripDays,
} from "@/lib/trip";
import type { Place, TripEvent } from "@/types";

const DEFAULT_DURATION_MIN = 90;

function eventStart(event: TripEvent): Date {
  return new Date(`${event.day}T${event.startTime}:00`);
}

function eventEnd(event: TripEvent): Date {
  return new Date(
    eventStart(event).getTime() +
      (event.durationMin ?? DEFAULT_DURATION_MIN) * 60_000
  );
}

function greeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 5) return "לילה טוב 🌙";
  if (hour < 12) return "בוקר טוב ☀️";
  if (hour < 18) return "צהריים טובים 🌞";
  return "ערב טוב 🌅";
}

function timeUntilLabel(target: Date, now: Date): string | null {
  const diffMin = Math.round((target.getTime() - now.getTime()) / 60_000);
  if (diffMin <= 0) return null;
  if (diffMin < 60) return `יוצאים בעוד ${diffMin} דקות`;
  const hours = Math.floor(diffMin / 60);
  const minutes = diffMin % 60;
  if (hours < 6)
    return `יוצאים בעוד ${hours} שע׳${minutes ? ` ו-${minutes} דק׳` : ""}`;
  return null;
}

export default function HomePage() {
  const { events, loading: eventsLoading } = useEvents();
  const { places } = usePlaces();
  const { families } = useFamilies();

  // Re-render every 30s so "יוצאים בעוד" stays fresh
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const today = todayIso();
  const duringTrip = today >= TRIP.startDate && today <= TRIP.endDate;

  const { nextEvent, todayEvents, currentEvent } = useMemo(() => {
    if (!events || !now)
      return { nextEvent: null, todayEvents: [], currentEvent: null };
    const todays = events.filter((e) => e.day === today);
    const current =
      todays.find((e) => eventStart(e) <= now && now < eventEnd(e)) ?? null;
    const upcoming =
      events.find((e) => eventStart(e) > now) ?? null;
    return { nextEvent: upcoming, todayEvents: todays, currentEvent: current };
  }, [events, now, today]);

  const nextPlace: Place | null =
    (nextEvent?.placeId && places?.find((p) => p.id === nextEvent.placeId)) ||
    null;

  const dayNumber = tripDayNumber(today);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-sea-600 to-sea-900 px-6 pb-7 pt-8 text-center shadow-xl shadow-sea-900/20">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 right-8 h-40 w-40 rounded-full bg-lemon-400/30 blur-2xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-sea-400/30 blur-2xl"
        />
        {duringTrip ? (
          <>
            <p className="text-2xl font-semibold text-cream-50">
              {now ? greeting(now) : "שלום ☀️"}
            </p>
            <h1 className="mt-1 font-display text-3xl font-bold text-cream-50">
              סיציליה 🇮🇹
            </h1>
            {dayNumber && (
              <p className="mt-2 text-lg text-sea-200">
                יום {dayNumber} מתוך {tripDays().length}
              </p>
            )}
          </>
        ) : (
          <>
            <p className="text-4xl" aria-hidden>
              🇮🇹
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold text-cream-50">
              {TRIP.heroTitle}
            </h1>
            <div className="mt-6">
              <Countdown targetIso={TRIP.countdownTarget} />
            </div>
            <p className="mt-4 text-sm text-sea-200">
              ✈️ ההמראה מנתב״ג · 15.8 · 21:35
            </p>
          </>
        )}
      </section>

      {/* Current activity */}
      {currentEvent && (
        <section className="rounded-3xl border-2 border-lemon-400 bg-lemon-100 px-5 py-4">
          <p className="text-sm font-medium text-ink-700">קורה עכשיו</p>
          <p className="mt-1 text-xl font-bold text-ink-900">
            {currentEvent.emoji ? `${currentEvent.emoji} ` : ""}
            {currentEvent.title}
          </p>
        </section>
      )}

      {/* Next activity */}
      <section>
        <h2 className="mb-3 font-display text-xl font-bold text-ink-900">
          הפעילות הבאה
        </h2>
        {eventsLoading || now === null ? (
          <ListSkeleton rows={1} />
        ) : nextEvent ? (
          <div className="rounded-3xl border border-cream-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-2xl font-bold text-ink-900">
                  {nextEvent.emoji ? `${nextEvent.emoji} ` : ""}
                  {nextEvent.title}
                </p>
                <p className="mt-1 text-ink-500">
                  {nextEvent.day === today
                    ? "היום"
                    : formatDayLabel(nextEvent.day)}{" "}
                  · {nextEvent.startTime}
                  {families
                    ? ` · 👥 ${participantsLabel(nextEvent.participants, families)}`
                    : ""}
                </p>
                {timeUntilLabel(eventStart(nextEvent), now) && (
                  <p className="mt-2 inline-block rounded-full bg-terra-100 px-3 py-1 text-sm font-semibold text-terra-600">
                    ⏰ {timeUntilLabel(eventStart(nextEvent), now)}
                  </p>
                )}
                {nextEvent.notes && (
                  <p className="mt-2 text-sm text-ink-500">
                    📝 {nextEvent.notes}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              {nextPlace && (
                <>
                  <a
                    href={wazeUrl(nextPlace)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 rounded-2xl bg-sea-600 py-3 text-center font-semibold text-cream-50"
                  >
                    🧭 נווט
                  </a>
                  <Link
                    href={`/places/${nextPlace.id}`}
                    className="flex-1 rounded-2xl bg-cream-100 py-3 text-center font-semibold text-ink-700"
                  >
                    פרטים
                  </Link>
                  <a
                    href={googleMapsUrl(nextPlace)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Google Maps"
                    className="rounded-2xl bg-cream-100 px-4 py-3 font-semibold text-ink-700"
                  >
                    🗺️
                  </a>
                </>
              )}
              {!nextPlace && (
                <Link
                  href="/calendar"
                  className="flex-1 rounded-2xl bg-cream-100 py-3 text-center font-semibold text-ink-700"
                >
                  ללוח המלא
                </Link>
              )}
            </div>
          </div>
        ) : (
          <EmptyState
            emoji="🗓️"
            title="אין פעילות מתוכננת"
            description="שבצו מקום מ׳מקומות׳ או הוסיפו אירוע בלוח"
            action={
              <Link
                href="/places"
                className="inline-block rounded-2xl bg-sea-600 px-5 py-2.5 text-sm font-semibold text-cream-50"
              >
                למקומות
              </Link>
            }
          />
        )}
      </section>

      {/* Today timeline */}
      {duringTrip && todayEvents.length > 0 && now && (
        <section>
          <h2 className="mb-3 font-display text-xl font-bold text-ink-900">
            הלו״ז של היום
          </h2>
          <ol className="space-y-2">
            {todayEvents.map((event) => {
              const isCurrent = currentEvent?.id === event.id;
              const isNext = nextEvent?.id === event.id;
              const isPast = eventEnd(event) < now;
              return (
                <li
                  key={event.id}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${
                    isCurrent
                      ? "bg-lemon-100 font-semibold"
                      : isNext
                        ? "border border-sea-200 bg-sea-100"
                        : isPast
                          ? "bg-cream-100 opacity-60"
                          : "bg-white"
                  }`}
                >
                  <span className="w-12 shrink-0 font-bold tabular-nums text-sea-700">
                    {event.startTime}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-ink-900">
                    {event.emoji ? `${event.emoji} ` : ""}
                    {event.title}
                  </span>
                  {isPast && <span aria-hidden>✓</span>}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* Unscheduled ideas */}
      {(places?.length ?? 0) > 0 && (
        <section>
          <h2 className="mb-3 font-display text-xl font-bold text-ink-900">
            עוד רעיונות
          </h2>
          <Link
            href="/places?filter=unscheduled"
            className="block rounded-3xl border border-cream-200 bg-white px-5 py-4 text-ink-700"
          >
            📍 {places!.length} מקומות שמורים · לגלות מה עוד לא שובץ ›
          </Link>
        </section>
      )}
    </div>
  );
}
