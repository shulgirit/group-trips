"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { RouteArt } from "@/components/journal/RouteArt";
import { Glyph, STROKE } from "@/components/ui/Icon";
import { useT } from "@/i18n";
import { formatShortDate } from "@together/i18n/format";
import type { TripSummary } from "@/lib/my-trips";
import { useTripCover } from "@/lib/place-photo";
import { useState } from "react";
import { auth } from "@/lib/firebase/client";
import { DeleteTripButton } from "./DeleteTripButton";

function daysUntil(dateIso: string, todayIso: string): number {
  return Math.round(
    (Date.parse(`${dateIso}T12:00:00`) - Date.parse(`${todayIso}T12:00:00`)) /
      86_400_000,
  );
}

const CARD_SHADOW =
  "shadow-[0_1px_2px_rgb(15_27_45/0.05),0_10px_28px_-22px_rgb(15_27_45/0.45)]";

/**
 * A trip on the hub. "feature" is the trip that matters most right now
 * (live or next up), "default" a regular cover card, "compact" a quiet row
 * for memories.
 */
export function TripCard({
  trip,
  today,
  variant = "default",
}: {
  trip: TripSummary;
  today: string;
  variant?: "feature" | "default" | "compact";
}) {
  const t = useT();
  // trips without a cover get their destination's photo (once, server-side)
  useTripCover(trip.id, !trip.coverImage && !trip.legacy);
  const isDraft = trip.status === "draft";
  const [deleted, setDeleted] = useState(false);
  const isOwner =
    !trip.legacy &&
    Boolean(trip.ownerUid) &&
    trip.ownerUid === auth().currentUser?.uid;
  const live = trip.phase === "live" && !isDraft;
  const days = daysUntil(trip.startDate, today);
  const href = isDraft ? `/new?trip=${trip.id}` : trip.href;
  // Legacy trips are gated by the session cookie: mint it before navigating
  async function openLegacy(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!trip.legacy || isDraft) return;
    event.preventDefault();
    try {
      const idToken = await auth().currentUser?.getIdToken();
      if (idToken) {
        await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken, tripId: trip.id }),
        });
      }
    } catch {
      // fall through: the gate will ask again
    }
    window.location.assign(href);
  }
  const badge = isDraft
    ? { label: t("product.card.draft"), className: "bg-cream-50 text-ink-700" }
    : live
      ? {
          label: t("product.card.live"),
          className: "bg-route-500 text-cream-50",
        }
      : trip.phase === "upcoming"
        ? {
            label:
              days === 1
                ? t("product.card.tomorrow")
                : t("product.card.inDays", { count: days }),
            className: "bg-night-950/70 text-brass-100 backdrop-blur",
          }
        : {
            label: t("product.card.past"),
            className: "bg-night-950/55 text-cream-50/85 backdrop-blur",
          };
  const dates = (
    <span dir="ltr" className="tabular-nums">
      {formatShortDate(trip.startDate)}–{formatShortDate(trip.endDate)}
    </span>
  );

  if (deleted) return null;
  const deleteButton = (tone: "dark" | "light", className = "") =>
    isOwner ? (
      <DeleteTripButton
        tripId={trip.id}
        tripName={trip.name}
        onDeleted={() => setDeleted(true)}
        tone={tone}
        className={className}
      />
    ) : null;

  if (variant === "compact") {
    return (
      <div
        className={`flex items-center rounded-2xl bg-white pe-1 ${CARD_SHADOW}`}
      >
        <Link
          href={href}
          onClick={openLegacy}
          className="flex min-w-0 flex-1 items-center gap-4 p-2.5 pe-2 transition active:scale-[0.99]"
        >
          <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-night-900">
            {trip.coverImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={trip.coverImage}
                alt=""
                className="h-full w-full object-cover grayscale-[30%]"
              />
            ) : (
              <RouteArt seed={trip.id} />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span
              className="block truncate font-medium text-ink-900"
              dir="auto"
            >
              {trip.name}
            </span>
            <span className="mt-0.5 block truncate text-sm text-ink-500">
              <bdi>{trip.destination}</bdi> · {dates}
            </span>
          </span>
          <ChevronRight
            size={18}
            strokeWidth={STROKE}
            aria-hidden
            className="shrink-0 text-ink-400 rtl:rotate-180"
          />
        </Link>
        {deleteButton("light")}
      </div>
    );
  }

  const feature = variant === "feature";
  return (
    <div className="relative">
      <Link
        href={href}
        onClick={openLegacy}
        className={`group relative block overflow-hidden rounded-[1.5rem] bg-night-900 transition active:scale-[0.99] ${CARD_SHADOW} ${live ? "ring-2 ring-route-500 ring-offset-2 ring-offset-cream-50" : ""}`}
      >
        <div
          className={`relative overflow-hidden ${feature ? "h-64 md:h-72" : "h-44"}`}
        >
          {trip.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={trip.coverImage}
              alt=""
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
          ) : (
            <RouteArt seed={trip.id} focus="top" />
          )}
          <div className="hero-overlay absolute inset-0" />
          <span
            className={`absolute start-4 top-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${badge.className}`}
          >
            {live && (
              <span aria-hidden className="relative flex h-2 w-2">
                <span className="absolute inset-0 rounded-full bg-cream-50/70 motion-safe:animate-ping" />
                <span className="relative h-2 w-2 rounded-full bg-cream-50" />
              </span>
            )}
            {badge.label}
          </span>
          <div className="absolute inset-x-5 bottom-4">
            <p className="text-sm text-cream-50/80">
              <bdi>{trip.destination}</bdi> · {dates}
            </p>
            <p
              className={`mt-1 flex items-center gap-2 font-display font-medium leading-tight text-cream-50 ${feature ? "text-[1.75rem] md:text-4xl" : "text-[1.375rem]"}`}
            >
              <Glyph
                value={trip.emoji}
                size={feature ? 22 : 18}
                className="shrink-0 opacity-75"
              />
              <span className="truncate" dir="auto">
                {trip.name}
              </span>
            </p>
          </div>
        </div>
      </Link>
      {deleteButton("dark", "absolute end-3 top-3")}
    </div>
  );
}
