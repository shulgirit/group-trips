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
  Ticket,
  UserPlus,
  Users,
  Vote,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Countdown } from "@/components/home/Countdown";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { Glyph, STROKE } from "@/components/ui/Icon";
import { RouteArt } from "@/components/journal/RouteArt";
import { useSession } from "@/components/providers/SessionProvider";
import { usePlacePhoto, useTripCover } from "@/lib/place-photo";
import { NotifyNudge } from "@/components/permissions/NotifyNudge";
import { useDayLabel, useLocale, useT, type TKey } from "@/i18n";
import { intlLocale } from "@together/i18n/format";
import { useEvents, useFamilies, usePlaces } from "@/lib/hooks";
import { stopForDay } from "@together/shared/trip-doc";
import { googleMapsUrl, wazeUrl } from "@together/shared/nav";
import { participantsLabel } from "@together/shared/participants";
import {
  todayIso,
  tripDayNumber,
  tripDays,
} from "@together/shared/trip";
import type { Place, TripEvent } from "@together/shared/types";
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

  const { locale } = useLocale();
  const { personal, role } = useSession();
  const canInvite = role === "owner" || role === "admin";

  const travelers = (families ?? []).flatMap((family) =>
    family.members.map((member) => ({ id: member.id, name: member.name, color: family.color }))
  );
  const stop = stopForDay(trip.stops, today);
  const region = nextEvent ? stopForDay(trip.stops, nextEvent.day).region : stop.region;
  const dateFormat = new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "long" });
  const dates = t("trip.home.tripDates", {
    start: dateFormat.format(new Date(`${trip.startDate}T12:00:00`)),
    end: dateFormat.format(new Date(`${trip.endDate}T12:00:00`)),
  });
  const timeUntil = nextEvent && now ? timeUntilLabel(eventStart(nextEvent), now, t) : null;
  usePlacePhoto(trip.id, nextPlace);
  useTripCover(trip.id, !trip.legacy && !trip.heroImage);

  const quick: { href: string; label: TKey; Icon: LucideIcon }[] = [
    { href: `${prefix}/calendar`, label: "trip.home.quick.schedule", Icon: CalendarDays },
    { href: `${prefix}/map`, label: "trip.home.quick.map", Icon: MapIcon },
    { href: `${prefix}/documents`, label: "trip.home.quick.tickets", Icon: Ticket },
    { href: `${prefix}/expenses`, label: "trip.home.quick.expenses", Icon: Wallet },
    canInvite
      ? { href: `${prefix}/settings`, label: "trip.home.quick.invite", Icon: UserPlus }
      : { href: `${prefix}/polls`, label: "trip.home.quick.polls", Icon: Vote },
  ];

  return (
    <div className="space-y-9">
      {/* ── Hero: the trip as the cover of its own journal ── */}
      <section className="relative -mx-4 -mt-4 overflow-hidden md:mx-0 md:mt-0 md:rounded-[1.75rem]">
        <div className="relative h-[360px] md:h-[420px]">
          {trip.heroImage ? <TripHeroBackdrop trip={trip} /> : <RouteArt seed={trip.id} focus="top" />}
          <div className="hero-overlay absolute inset-0" />
          {(!trip.legacy || personal) && (
            <Link
              href="/trips"
              className="absolute end-4 top-[max(1rem,env(safe-area-inset-top))] inline-flex items-center gap-1.5 rounded-full bg-night-950/45 px-3 py-1.5 text-xs font-medium text-cream-50 backdrop-blur"
            >
              <LayoutGrid size={14} strokeWidth={STROKE} aria-hidden />
              {t("settings.more.myTrips")}
            </Link>
          )}
          <div className="absolute inset-x-0 bottom-0 px-6 pb-6">
            {duringTrip ? (
              <>
                <p className="text-sm text-cream-50/80">
                  {dayNumber
                    ? t("trip.home.dayOf", { day: dayNumber, total: tripDays(trip).length })
                    : dates}
                </p>
                <h1 className="mt-1.5 font-serif text-display-sm font-medium text-cream-50 md:text-display">
                  {now ? t(greetingKey(now)) : t("trip.home.greeting.hello")}
                </h1>
                <p className="mt-2 text-[15px] text-cream-50/85">
                  {t("trip.home.nowIn", { place: stop.label })}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-cream-50/80">{dates}</p>
                <h1 className="mt-1.5 font-serif text-display-sm font-medium leading-[1.08] text-cream-50 md:text-display">
                  {trip.heroTitle}
                </h1>
                <div className="mt-5 flex justify-start">
                  <Countdown targetIso={trip.countdownTarget} />
                </div>
              </>
            )}
            {travelers.length > 0 && (
              <Link
                href={`${prefix}/families`}
                className="mt-5 inline-flex items-center gap-3 rounded-full py-1 pe-3 text-sm text-cream-50/85"
              >
                <span className="flex -space-x-2 rtl:space-x-reverse">
                  {travelers.slice(0, 5).map((person) => (
                    <span
                      key={person.id}
                      className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-night-950/60 bg-cream-50 text-xs font-medium text-night-950"
                    >
                      {person.name.slice(0, 1)}
                    </span>
                  ))}
                </span>
                {t("trip.home.group", { count: travelers.length })}
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ── Quick access: the core tools, one tap away ── */}
      <nav aria-label={t("trip.nav.aria")} className="-mt-3 grid grid-cols-5 gap-2">
        {quick.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center gap-1.5 rounded-2xl py-2.5 text-ink-700 transition active:scale-[0.97] active:bg-chart-100"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-chart-200 bg-white">
              <Icon size={19} strokeWidth={STROKE} aria-hidden />
            </span>
            <span className="text-xs font-medium">{t(label)}</span>
          </Link>
        ))}
      </nav>

      {/* ── Reminders, asked at a moment that makes sense ── */}
      <NotifyNudge tripId={trip.id} />

      {/* ── Happening now ── */}
      {currentEvent && (
        <section className="flex items-center gap-4 rounded-2xl bg-night-950 px-5 py-4 text-cream-50">
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="absolute inset-0 animate-ping rounded-full bg-brass-500/60" />
            <span className="relative h-3 w-3 rounded-full bg-brass-500" />
          </span>
          <div className="min-w-0">
            <p className="text-xs text-cream-50/70">{t("trip.home.happeningNow")}</p>
            <p className="truncate text-lg font-medium"><bdi>{currentEvent.title}</bdi></p>
          </div>
        </section>
      )}

      {/* ── Next up: the one card that answers when, where and how ── */}
      <section aria-labelledby="next-up">
        <h2 id="next-up" className="mb-3 font-serif text-2xl font-medium text-ink-900">
          {t("trip.home.nextActivity")}
        </h2>
        {eventsLoading || now === null ? (
          <ListSkeleton rows={1} />
        ) : nextEvent ? (
          <article className="overflow-hidden rounded-[1.5rem] bg-white shadow-[0_1px_2px_rgb(15_27_45/0.05),0_18px_40px_-28px_rgb(15_27_45/0.35)]">
            <div className="relative h-44">
              {nextPlace?.imageUrl || (!nextPlace && trip.heroImage) ? (
                <Image
                  src={(nextPlace?.imageUrl || trip.heroImage)!}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 100vw, 576px"
                  className="object-cover"
                />
              ) : (
                <RouteArt seed={nextEvent.id} />
              )}
              {timeUntil && (
                <span className="absolute start-4 top-4 rounded-full bg-night-950/75 px-3 py-1.5 text-xs font-medium text-brass-100 backdrop-blur">
                  {timeUntil}
                </span>
              )}
            </div>
            <div className="px-5 pb-5 pt-4">
              <div className="flex items-start gap-4">
                <div className="shrink-0 text-center">
                  <p dir="ltr" className="font-serif text-[1.75rem] leading-none text-ink-900 tabular-nums">
                    {nextEvent.startTime}
                  </p>
                  <p className="mt-1.5 text-xs text-ink-500">
                    {nextEvent.day === today ? t("common.today") : formatDayLabel(nextEvent.day)}
                  </p>
                </div>
                <div className="min-w-0 flex-1 border-s border-chart-200 ps-4">
                  <p className="text-lg font-medium leading-snug text-ink-900"><bdi>{nextEvent.title}</bdi></p>
                  {nextPlace && <p className="mt-0.5 truncate text-sm text-ink-500"><bdi>{nextPlace.name}</bdi></p>}
                  {families && (
                    <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-500">
                      <Users size={15} strokeWidth={STROKE} aria-hidden className="shrink-0" />
                      <span className="truncate">{participantsLabel(nextEvent.participants, families)}</span>
                    </p>
                  )}
                  {nextEvent.notes && <p className="mt-2 text-sm leading-relaxed text-ink-700"><bdi>{nextEvent.notes}</bdi></p>}
                </div>
              </div>
              <div className="mt-5 flex gap-2">
                {nextPlace ? (
                  <>
                    <a
                      href={wazeUrl(nextPlace, region)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-accent flex-1 py-3.5"
                    >
                      <Compass size={18} strokeWidth={STROKE} aria-hidden />
                      {t("trip.home.navigate")}
                    </a>
                    <Link href={`${prefix}/places/${nextPlace.id}`} className="btn-soft flex-1 py-3.5">
                      {t("trip.home.details")}
                    </Link>
                    <a
                      href={googleMapsUrl(nextPlace, region)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Google Maps"
                      className="btn-outline px-4 py-3.5"
                    >
                      <MapIcon size={18} strokeWidth={STROKE} aria-hidden />
                    </a>
                  </>
                ) : (
                  <Link href={`${prefix}/calendar`} className="btn-soft flex-1 py-3.5">
                    <CalendarDays size={18} strokeWidth={STROKE} aria-hidden />
                    {t("trip.home.fullSchedule")}
                  </Link>
                )}
              </div>
            </div>
          </article>
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

      {/* ── Today as a route: done, now, next ── */}
      {duringTrip && todayEvents.length > 0 && now && (
        <section aria-labelledby="today">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 id="today" className="font-serif text-2xl font-medium text-ink-900">
              {t("trip.home.todaySchedule")}
            </h2>
            <Link href={`${prefix}/calendar`} className="text-sm font-medium text-route-700">
              {t("trip.home.fullSchedule")}
            </Link>
          </div>
          <ol>
            {todayEvents.map((event, index) => {
              const isCurrent = currentEvent?.id === event.id;
              const isNext = !currentEvent && nextEvent?.id === event.id;
              const isPast = eventEnd(event) < now;
              const last = index === todayEvents.length - 1;
              return (
                <li key={event.id} className="relative flex gap-4">
                  <span className="relative flex w-4 shrink-0 justify-center">
                    {!last && (
                      <span
                        aria-hidden
                        className={`absolute top-5 h-full w-px ${isPast ? "bg-route-500" : "bg-chart-200"}`}
                      />
                    )}
                    <span
                      aria-hidden
                      className={`relative mt-[18px] rounded-full ${
                        isCurrent
                          ? "h-4 w-4 bg-brass-500 ring-4 ring-brass-100"
                          : isNext
                            ? "h-3.5 w-3.5 border-2 border-route-500 bg-white"
                            : isPast
                              ? "h-3 w-3 bg-route-500"
                              : "h-3 w-3 border-2 border-chart-200 bg-white"
                      }`}
                    />
                  </span>
                  <Link
                    href={`${prefix}/calendar/${event.id}`}
                    className={`mb-2 flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-4 py-3.5 transition active:scale-[0.99] ${
                      isCurrent
                        ? "bg-white shadow-[0_1px_2px_rgb(15_27_45/0.06),0_10px_24px_-18px_rgb(15_27_45/0.4)]"
                        : isPast
                          ? "text-ink-500"
                          : "bg-white/70"
                    }`}
                  >
                    <span dir="ltr" className={`w-12 shrink-0 text-[15px] tabular-nums ${isPast ? "text-ink-400" : "text-ink-900"}`}>
                      {event.startTime}
                    </span>
                    {event.emoji && (
                      <Glyph value={event.emoji} fallback={CalendarDays} size={16} className="shrink-0 text-ink-500" />
                    )}
                    <span className={`min-w-0 flex-1 truncate ${isCurrent ? "font-medium text-ink-900" : isPast ? "" : "text-ink-900"}`}>
                      <bdi>{event.title}</bdi>
                    </span>
                    {isCurrent ? (
                      <span className="shrink-0 text-xs font-medium text-brass-600">{t("trip.home.timelineNow")}</span>
                    ) : isNext ? (
                      <span className="shrink-0 text-xs font-medium text-route-700">{t("trip.home.timelineNext")}</span>
                    ) : isPast ? (
                      <Check size={16} strokeWidth={STROKE} aria-label={t("trip.home.timelineDone")} className="shrink-0 text-route-500" />
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* ── Saved ideas not yet scheduled ── */}
      {(places?.length ?? 0) > 0 && (
        <Link
          href={`${prefix}/places`}
          className="flex items-center gap-4 border-t border-chart-200 pt-5 text-ink-700"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-route-100 text-route-700">
            <Glyph value={trip.emoji} fallback={MapIcon} size={18} />
          </span>
          <span className="flex-1">{t("trip.home.savedPlaces", { count: places!.length })}</span>
          <ChevronRight size={18} strokeWidth={STROKE} aria-hidden className="text-ink-400 rtl:rotate-180" />
        </Link>
      )}
    </div>
  );
}
