"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  CalendarDays,
  Check,
  ChevronRight,
  Compass,
  LayoutGrid,
  Map as MapIcon,
  MapPin,
  Users,
  Waves,
} from "lucide-react";
import { Countdown } from "@/components/home/Countdown";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { CategoryIcon, Glyph, STROKE } from "@/components/ui/Icon";
import { useDayLabel, useT, type TKey } from "@/i18n";
import { useEvents, useFamilies, usePlaces } from "@/lib/hooks";
import { googleMapsUrl, wazeUrl } from "@/lib/nav";
import { participantsLabel } from "@/lib/participants";
import {
  todayIso,
  tripDayNumber,
  tripDays,
} from "@/lib/trip";
import type { Place, TripEvent } from "@/types";
import { useTrip } from "@/components/providers/TripProvider";
import { TripHeroBackdrop } from "@/components/layout/TripHeroBackdrop";

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

function greetingKey(now: Date): TKey {
  const hour = now.getHours();
  if (hour < 5) return "trip.home.greeting.night";
  if (hour < 12) return "trip.home.greeting.morning";
  if (hour < 18) return "trip.home.greeting.afternoon";
  return "trip.home.greeting.evening";
}

function timeUntilLabel(
  target: Date,
  now: Date,
  t: ReturnType<typeof useT>
): string | null {
  const diffMin = Math.round((target.getTime() - now.getTime()) / 60_000);
  if (diffMin <= 0) return null;
  if (diffMin < 60) return t("trip.home.leavingInMinutes", { count: diffMin });
  const hours = Math.floor(diffMin / 60);
  const minutes = diffMin % 60;
  if (hours < 6)
    return minutes
      ? t("trip.home.leavingInHoursMinutes", { hours, minutes })
      : t("trip.home.leavingInHours", { hours });
  if (hours < 24) return t("trip.home.inHours", { count: hours });
  return null;
}

export default function HomePage() {
  const trip = useTrip();
  const { prefix } = trip;
  const t = useT();
  const formatDayLabel = useDayLabel();
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
  const duringTrip = today >= trip.startDate && today <= trip.endDate;

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

  const dayNumber = tripDayNumber(today, trip);

  return (
    <div className="space-y-8">
      {/* ── Cinematic hero ── */}
      <section className="relative -mx-4 -mt-4 overflow-hidden md:mx-0 md:mt-0 md:rounded-[2rem]">
        <div className="relative h-[340px] md:h-[400px]">
          <TripHeroBackdrop trip={trip} />
          <div className="hero-overlay absolute inset-0" />
          {!trip.legacy && (
            <Link
              href="/trips"
              className="absolute end-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-cream-50/30 bg-ink-900/30 px-3 py-1.5 text-xs font-medium text-cream-50 backdrop-blur"
            >
              <LayoutGrid size={14} strokeWidth={STROKE} aria-hidden />
              {t("settings.more.myTrips")}
            </Link>
          )}
          <div className="absolute inset-x-0 bottom-0 px-6 pb-7 text-center">
            <p className="kicker text-lemon-300">{trip.kicker}</p>
            {duringTrip ? (
              <>
                <h1 className="mt-3 font-display text-4xl font-extralight tracking-tight text-cream-50">
                  {now ? t(greetingKey(now)) : t("trip.home.greeting.hello")}
                </h1>
                {dayNumber && (
                  <p className="mt-3 text-base font-light text-cream-50/85">
                    {t("trip.home.dayOf", {
                      day: dayNumber,
                      total: tripDays(trip).length,
                    })}{" "}
                    · {trip.dayLabelSuffix}
                  </p>
                )}
              </>
            ) : (
              <>
                <h1 className="mt-3 font-display text-4xl font-extralight leading-tight tracking-tight text-cream-50">
                  {trip.heroTitle}
                </h1>
                <div className="mt-6">
                  <Countdown targetIso={trip.countdownTarget} />
                </div>
                <p className="mt-5 text-sm font-light text-cream-50/80">
                  {trip.departureNote}
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── Happening now ── */}
      {currentEvent && (
        <section className="card overflow-hidden border-s-2 border-s-lemon-500">
          <div className="px-5 py-5">
            <p className="kicker text-lemon-500">{t("trip.home.happeningNow")}</p>
            <p className="mt-2 flex items-center gap-2 font-display text-2xl font-light text-ink-900">
              {currentEvent.emoji && (
                <Glyph value={currentEvent.emoji} fallback={CalendarDays} size={20} className="shrink-0 text-ink-500" />
              )}
              <span className="min-w-0">{currentEvent.title}</span>
            </p>
          </div>
        </section>
      )}

      {/* ── Next activity ── */}
      <section>
        <h2 className="section-title mb-3">{t("trip.home.nextActivity")}</h2>
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
                <div className="absolute inset-0 bg-sea-900">
                  <span className="absolute inset-0 flex items-center justify-center pb-8 text-cream-50/50">
                    {nextEvent.emoji ? (
                      <Glyph value={nextEvent.emoji} fallback={Waves} size={44} strokeWidth={1.25} />
                    ) : nextPlace ? (
                      <CategoryIcon category={nextPlace.category} size={44} strokeWidth={1.25} />
                    ) : (
                      <Waves size={44} strokeWidth={1.25} aria-hidden />
                    )}
                  </span>
                </div>
              )}
              <div className="hero-overlay absolute inset-0" />
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 px-5 pb-4">
                <div className="min-w-0">
                  <p className="truncate font-display text-2xl font-light text-cream-50">
                    {nextEvent.title}
                  </p>
                  <p className="mt-1 text-sm font-light text-cream-50/85">
                    {nextEvent.day === today
                      ? t("common.today")
                      : formatDayLabel(nextEvent.day)}
                    {" · "}
                    <span dir="ltr" className="tabular-nums">
                      {nextEvent.startTime}
                    </span>
                  </p>
                </div>
                {timeUntilLabel(eventStart(nextEvent), now, t) && (
                  <span className="shrink-0 rounded-full border border-lemon-300/70 bg-sea-950/40 px-3 py-1.5 text-xs font-medium text-lemon-200 backdrop-blur">
                    {timeUntilLabel(eventStart(nextEvent), now, t)}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-4 px-5 py-5">
              {families && (
                <p className="flex items-center gap-2 text-sm text-ink-500">
                  <Users size={15} strokeWidth={STROKE} aria-hidden />
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
                      <Compass size={18} strokeWidth={STROKE} aria-hidden />
                      {t("trip.home.navigate")}
                    </a>
                    <Link
                      href={`${prefix}/places/${nextPlace.id}`}
                      className="btn-soft flex-1 py-3"
                    >
                      {t("trip.home.details")}
                    </Link>
                    <a
                      href={googleMapsUrl(nextPlace)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Google Maps"
                      className="btn-outline px-4 py-3"
                    >
                      <MapIcon size={18} strokeWidth={STROKE} aria-hidden />
                    </a>
                  </>
                ) : (
                  <Link href={`${prefix}/calendar`} className="btn-soft flex-1 py-3">
                    <CalendarDays size={18} strokeWidth={STROKE} aria-hidden />
                    {t("trip.home.fullSchedule")}
                  </Link>
                )}
              </div>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={CalendarDays}
            title={t("trip.home.emptyTitle")}
            description={t("trip.home.emptyDescription")}
            action={
              <Link href={`${prefix}/places`} className="btn-primary px-5 py-2.5 text-sm">
                {t("trip.home.toPlaces")}
              </Link>
            }
          />
        )}
      </section>

      {/* ── Today timeline ── */}
      {duringTrip && todayEvents.length > 0 && now && (
        <section>
          <h2 className="section-title mb-3">{t("trip.home.todaySchedule")}</h2>
          <ol className="relative space-y-1.5 border-e border-cream-200 pe-5">
            {todayEvents.map((event) => {
              const isCurrent = currentEvent?.id === event.id;
              const isNext = nextEvent?.id === event.id;
              const isPast = eventEnd(event) < now;
              return (
                <li key={event.id} className="relative">
                  <span
                    aria-hidden
                    className={`absolute -end-[26.5px] top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-cream-50 ${
                      isCurrent
                        ? "bg-lemon-500"
                        : isNext
                          ? "bg-sea-700"
                          : isPast
                            ? "bg-cream-300"
                            : "bg-cream-200"
                    }`}
                  />
                  <div
                    className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${
                      isCurrent
                        ? "border border-lemon-300 bg-white font-medium"
                        : isNext
                          ? "border border-sea-200 bg-white"
                          : isPast
                            ? "opacity-55"
                            : "bg-white"
                    }`}
                  >
                    <span
                      dir="ltr"
                      className="numerals w-12 shrink-0 text-sea-700"
                    >
                      {event.startTime}
                    </span>
                    {event.emoji && (
                      <Glyph value={event.emoji} fallback={CalendarDays} size={16} className="shrink-0 text-ink-500" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-ink-900">
                      {event.title}
                    </span>
                    {isPast && <Check size={16} strokeWidth={STROKE} aria-hidden className="text-ink-300" />}
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
          <h2 className="section-title mb-3">{t("trip.home.worthChecking")}</h2>
          <Link
            href={`${prefix}/places`}
            className="card flex items-center gap-4 px-5 py-4 transition active:scale-[0.99]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cream-200 text-sea-700">
              <Glyph value={trip.emoji} fallback={MapPin} size={18} />
            </span>
            <span className="flex-1 text-ink-700">
              {t("trip.home.savedPlaces", { count: places!.length })}
            </span>
            <ChevronRight size={18} strokeWidth={STROKE} aria-hidden className="text-ink-300 rtl:rotate-180" />
          </Link>
        </section>
      )}
    </div>
  );
}
