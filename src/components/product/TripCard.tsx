"use client";

import Link from "next/link";
import { Glyph } from "@/components/ui/Icon";
import { useT } from "@/i18n";
import { formatShortDate } from "@/i18n/format";
import type { TripSummary } from "@/lib/my-trips";
import { useState } from "react";
import { auth } from "@/lib/firebase/client";
import { DeleteTripButton } from "./DeleteTripButton";
import { useTripCover } from "@/lib/place-photo";

function daysUntil(dateIso: string, todayIso: string): number {
  return Math.round(
    (Date.parse(`${dateIso}T12:00:00`) - Date.parse(`${todayIso}T12:00:00`)) /
      86_400_000,
  );
}

export function TripCard({
  trip,
  today,
}: {
  trip: TripSummary;
  today: string;
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

  /**
   * Sicily/Sardinia still sit behind their own session cookie. A signed-in
   * member gets it from their Google identity first — otherwise the trip
   * would bounce to its login page (or back here).
   */
  async function openLegacy(event: React.MouseEvent<HTMLAnchorElement>) {
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
      // fall through: the trip's own login page handles anything left
    }
    window.location.assign(trip.href);
  }
  const days = daysUntil(trip.startDate, today);
  const badge = isDraft
    ? { label: t("product.card.draft"), className: "bg-cream-50 text-ink-700" }
    : trip.phase === "live"
      ? {
          label: t("product.card.live"),
          className: "bg-terra-500 text-cream-50",
          live: true,
        }
      : trip.phase === "upcoming"
        ? {
            label:
              days === 1
                ? t("product.card.tomorrow")
                : t("product.card.inDays", { count: days }),
            className: "bg-cream-50/90 text-sea-700",
          }
        : {
            label: t("product.card.past"),
            className: "bg-cream-50/80 text-ink-500",
          };

  if (deleted) return null;

  return (
    <div className="relative">
      <Link
        href={isDraft ? `/new?trip=${trip.id}` : trip.href}
        onClick={trip.legacy ? (event) => openLegacy(event) : undefined}
        className={`card group block overflow-hidden transition active:scale-[0.99] ${trip.phase === "live" && !isDraft ? "ring-1 ring-terra-400" : ""}`}
      >
        <div className="relative h-36 overflow-hidden bg-sea-900">
          {trip.coverImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={trip.coverImage}
              alt=""
              className={`h-full w-full object-cover transition duration-500 group-hover:scale-105 ${trip.phase === "past" ? "grayscale-[35%]" : ""}`}
            />
          )}
          {!trip.coverImage && (
            <span
              aria-hidden
              className="absolute inset-0 flex items-center justify-center text-cream-50/60"
            >
              <Glyph value={trip.emoji} size={44} />
            </span>
          )}
          <div className="hero-overlay absolute inset-0" />
          <span
            className={`absolute start-3 top-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${badge.className}`}
          >
            {"live" in badge && (
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full bg-cream-50"
              />
            )}
            {badge.label}
          </span>
          <div className="absolute inset-x-4 bottom-3">
            <p className="flex items-center gap-2 font-display text-2xl font-light text-cream-50 drop-shadow">
              <Glyph
                value={trip.emoji}
                size={20}
                className="shrink-0 opacity-80"
              />
              <span className="truncate">{trip.name}</span>
            </p>
            <p className="text-sm text-cream-50/85">
              {trip.destination} ·{" "}
              <span dir="ltr" className="numerals">
                {formatShortDate(trip.startDate)}–
                {formatShortDate(trip.endDate)}
              </span>
            </p>
          </div>
        </div>
      </Link>
      {isOwner && (
        <DeleteTripButton
          tripId={trip.id}
          tripName={trip.name}
          onDeleted={() => setDeleted(true)}
          className="absolute end-2 top-2"
        />
      )}
    </div>
  );
}
