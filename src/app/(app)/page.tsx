"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Check, Compass, Map as MapIcon, Users } from "lucide-react";
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
import { PLACE_CATEGORIES, type Place, type TripEvent } from "@/types";

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
  if (hours < 24) return `בעוד ${hours} שעות`;
  return null;
}

export default function HomePage() {
  const { events, loading: eventsLoading } = useEvents();
  const { places } = usePlaces();
  const { families } = useFamilies();

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
    const upcoming = events.find((e) => eventStart(e) > now) ?? null;
    return { nextEvent: upcoming, todayEvents: todays, currentEvent: current };
  }, [events, now, today]);

  const nextPlace: Place | null =
    (nextEvent?.placeId && places?.find((p) => p.id === nextEvent.placeId)) ||
    null;
  const nextCategory = nextPlace
    ? (PLACE_CATEGORIES[nextPlace.category] ?? PLACE_CATEGORIES.other)
    : null;

  const dayNumber = tripDayNumber(today);

  return (
    <div className="space-y-8">
      {/* ── Cinematic hero ── */}
      <section className="relative -mx-4 -mt-4 overflow-hidden md:mx-0 md:mt-0 md:rounded-[2rem]">
        <div className="relative h-[340px] md:h-[400px]">
          <Image
            src={TRIP.heroImage}
            alt=""
            fill
            priority
            sizes="(max-width: 768px) 100vw, 576px"
            className="object-cover"
          />
          <div className="hero-overlay absolute inset-0" />
          <div className="absolute inset-x-0 bottom-0 px-6 pb-7 text-center">
            <p className="kicker text-lemon-300">Sicily Together</p>
            {duringTrip ? (
              <>
                <h1 className="mt-2 font-display text-4xl font-bold text-cream-50">
                  {now ? greeting(now) : "שלום ☀️"}
                </h1>
                {dayNumber && (
                  <p className="mt-2 text-lg text-cream-50/85">
                    יום {dayNumber} מתוך {tripDays().length} · סיציליה 🇮🇹
                  </p>
                )}
              </>
            ) : (
              <>
                <h1 className="mt-2 font-display text-4xl font-bold leading-tight text-cream-50">
                  {TRIP.heroTitle}
                </h1>
                <div className="mt-5">
                  <Countdown targetIso={TRIP.countdownTarget} />
                </div>
                <p className="mt-4 text-sm text-cream-50/80">
                  ✈️ ההמראה מנתב״ג · שבת 15.8 · 21:35
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── Happening now ── */}
      {currentEvent && (
        <section className="card overflow-hidden border-lemon-300 bg-lemon-100">
          <div className="px-5 py-4">
            <p className="kicker text-terra-600">קורה עכשיו</p>
            <p className="mt-1.5 font-display text-2xl font-bold text-ink-900">
              {currentEvent.emoji ? `${currentEvent.emoji} ` : ""}
              {currentEvent.title}
            </p>
          </div>
        </section>
      )}

      {/* ── Next activity ── */}
      <section>
        <h2 className="section-title mb-3">הפעילות הבאה</h2>
        {eventsLoading || now === null ? (
          <ListSkeleton rows={1} />
        ) : nextEvent ? (
          <div className="card overflow-hidden">
            {/* Visual header */}
            <div className="relative h-40">
              {nextPlace?.imageUrl ? (
                <Image
                  src={nextPlace.imageUrl}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 100vw, 576px"
                  className="object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-sea-600 to-sea-900">
                  <span className="absolute inset-0 flex items-center justify-center text-6xl opacity-70">
                    {nextEvent.emoji ?? nextCategory?.emoji ?? "🌊"}
                  </span>
                </div>
              )}
              <div className="hero-overlay absolute inset-0" />
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 px-5 pb-4">
                <div className="min-w-0">
                  <p className="truncate font-display text-2xl font-bold text-cream-50">
                    {nextEvent.emoji ? `${nextEvent.emoji} ` : ""}
                    {nextEvent.title}
                  </p>
                  <p className="mt-0.5 text-sm text-cream-50/85">
                    {nextEvent.day === today
                      ? "היום"
                      : formatDayLabel(nextEvent.day)}
                    {" · "}
                    <span dir="ltr" className="tabular-nums">
                      {nextEvent.startTime}
                    </span>
                  </p>
                </div>
                {timeUntilLabel(eventStart(nextEvent), now) && (
                  <span className="shrink-0 rounded-full bg-lemon-400 px-3 py-1.5 text-xs font-bold text-sea-950">
                    {timeUntilLabel(eventStart(nextEvent), now)}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-3 px-5 py-4">
              {families && (
                <p className="flex items-center gap-2 text-sm text-ink-500">
                  <Users size={15} />
                  {participantsLabel(nextEvent.participants, families)}
                  {nextEvent.notes && (
                    <span className="text-ink-300">· {nextEvent.notes}</span>
                  )}
                </p>
              )}
              <div className="flex gap-2">
                {nextPlace ? (
                  <>
                    <a
                      href={wazeUrl(nextPlace)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary flex-1 py-3"
                    >
                      <Compass size={18} />
                      נווט
                    </a>
                    <Link
                      href={`/places/${nextPlace.id}`}
                      className="btn-soft flex-1 py-3"
                    >
                      פרטים
                    </Link>
                    <a
                      href={googleMapsUrl(nextPlace)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Google Maps"
                      className="btn-soft px-4 py-3"
                    >
                      <MapIcon size={18} />
                    </a>
                  </>
                ) : (
                  <Link href="/calendar" className="btn-soft flex-1 py-3">
                    <CalendarDays size={18} />
                    ללוח המלא
                  </Link>
                )}
              </div>
            </div>
          </div>
        ) : (
          <EmptyState
            emoji="🗓️"
            title="אין פעילות מתוכננת"
            description="שבצו מקום מ׳מקומות׳ או הוסיפו אירוע בלוח"
            action={
              <Link href="/places" className="btn-primary px-5 py-2.5 text-sm">
                למקומות
              </Link>
            }
          />
        )}
      </section>

      {/* ── Today timeline ── */}
      {duringTrip && todayEvents.length > 0 && now && (
        <section>
          <h2 className="section-title mb-3">הלו״ז של היום</h2>
          <ol className="relative space-y-1.5 border-e-2 border-cream-200 pe-5">
            {todayEvents.map((event) => {
              const isCurrent = currentEvent?.id === event.id;
              const isNext = nextEvent?.id === event.id;
              const isPast = eventEnd(event) < now;
              return (
                <li key={event.id} className="relative">
                  <span
                    aria-hidden
                    className={`absolute -end-[25px] top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-cream-50 ${
                      isCurrent
                        ? "bg-lemon-400"
                        : isNext
                          ? "bg-sea-500"
                          : isPast
                            ? "bg-cream-300"
                            : "bg-cream-200"
                    }`}
                  />
                  <div
                    className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${
                      isCurrent
                        ? "bg-lemon-100 font-semibold"
                        : isNext
                          ? "border border-sea-200 bg-sea-100"
                          : isPast
                            ? "opacity-55"
                            : "bg-white"
                    }`}
                  >
                    <span
                      dir="ltr"
                      className="w-12 shrink-0 font-bold tabular-nums text-sea-700"
                    >
                      {event.startTime}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-ink-900">
                      {event.emoji ? `${event.emoji} ` : ""}
                      {event.title}
                    </span>
                    {isPast && <Check size={16} className="text-ink-300" />}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* ── More ideas ── */}
      {(places?.length ?? 0) > 0 && (
        <section>
          <h2 className="section-title mb-3">שווה לבדוק</h2>
          <Link
            href="/places"
            className="card flex items-center gap-4 px-5 py-4 transition active:scale-[0.99]"
          >
            <span className="text-2xl" aria-hidden>
              🍋
            </span>
            <span className="flex-1 text-ink-700">
              {places!.length} מקומות שמורים · מה עוד לא שובץ?
            </span>
            <span aria-hidden className="text-ink-300">
              ‹
            </span>
          </Link>
        </section>
      )}
    </div>
  );
}
