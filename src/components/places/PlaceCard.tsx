"use client";

import Image from "next/image";
import Link from "next/link";
import { CalendarCheck, Heart, MapPin } from "lucide-react";
import type { Place, PlaceCategory } from "@/types";
import { useTrip } from "@/components/providers/TripProvider";
import { CategoryIcon, STROKE } from "@/components/ui/Icon";
import { useT } from "@/i18n";

/** Quiet, category-tinted fallback fields for places without photography */
const CATEGORY_TONES: Record<PlaceCategory, string> = {
  attraction: "bg-sea-900",
  restaurant: "bg-sea-900",
  beach: "bg-sea-700",
  icecream: "bg-sea-700",
  shopping: "bg-sea-900",
  supermarket: "bg-olive-500",
  viewpoint: "bg-sea-900",
  parking: "bg-ink-500",
  accommodation: "bg-olive-500",
  sport: "bg-sea-700",
  other: "bg-sea-900",
};

export function PlaceCard({
  place,
  scheduled,
  distanceLabel,
}: {
  place: Place;
  scheduled: boolean;
  /** "1.2 km" when sorting by distance from the user */
  distanceLabel?: string | null;
}) {
  const { prefix } = useTrip();
  const t = useT();
  const categoryKey: PlaceCategory = place.category in CATEGORY_TONES ? place.category : "other";
  const categoryLabel = t(`trip.categories.${categoryKey}`);

  return (
    <Link
      href={`${prefix}/places/${place.id}`}
      className="card block overflow-hidden transition active:scale-[0.99]"
    >
      <div className="relative aspect-[16/9]">
        {place.imageUrl ? (
          <Image
            src={place.imageUrl}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 576px"
            className="object-cover"
          />
        ) : (
          <div className={`absolute inset-0 ${CATEGORY_TONES[categoryKey]}`}>
            <span className="absolute inset-0 flex items-center justify-center text-cream-50/60">
              <CategoryIcon category={categoryKey} size={40} strokeWidth={1.25} />
            </span>
          </div>
        )}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-sea-950/65 to-transparent"
        />
        {/* Category chip */}
        <span className="absolute start-3 top-3 flex items-center gap-1.5 rounded-full bg-cream-50/90 px-3 py-1 text-xs font-medium text-ink-700 backdrop-blur">
          <CategoryIcon category={categoryKey} size={13} />
          {categoryLabel}
        </span>
        {place.favorite && (
          <span className="absolute end-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-cream-50/90 backdrop-blur">
            <Heart size={15} strokeWidth={STROKE} aria-hidden className="fill-terra-500 text-terra-500" />
          </span>
        )}
        {/* Name over image */}
        <div className="absolute inset-x-0 bottom-0 px-4 pb-2.5">
          <h3 className="truncate font-display text-xl font-light text-cream-50">
            {place.name}
          </h3>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <p className="truncate text-sm text-ink-500">
          {distanceLabel ? (
            <span className="inline-flex items-center gap-1 font-medium text-sea-700">
              <MapPin size={12} strokeWidth={STROKE} aria-hidden />
              {distanceLabel}
              <span className="text-ink-300"> · </span>
            </span>
          ) : null}
          {place.area || categoryLabel}
        </p>
        {scheduled ? (
          <span className="flex shrink-0 items-center gap-1 rounded-full border border-sea-200 px-2.5 py-1 text-xs font-medium text-sea-700">
            <CalendarCheck size={12} strokeWidth={STROKE} aria-hidden />
            {t("trip.placeCard.scheduled")}
          </span>
        ) : (
          <span className="shrink-0 rounded-full border border-cream-200 px-2.5 py-1 text-xs text-ink-500">
            {t("trip.placeCard.notScheduled")}
          </span>
        )}
      </div>
    </Link>
  );
}
