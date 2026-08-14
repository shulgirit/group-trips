"use client";

import Image from "next/image";
import Link from "next/link";
import { CalendarCheck, Heart } from "lucide-react";
import { PLACE_CATEGORIES, type Place, type PlaceCategory } from "@/types";

/** Category-tinted fallback art for places without photography */
const CATEGORY_TONES: Record<PlaceCategory, string> = {
  attraction: "from-sea-500 to-sea-800",
  restaurant: "from-terra-400 to-terra-600",
  beach: "from-sea-400 to-sea-700",
  icecream: "from-lemon-300 to-terra-400",
  shopping: "from-terra-400 to-sea-700",
  supermarket: "from-olive-500 to-sea-800",
  viewpoint: "from-lemon-400 to-terra-600",
  parking: "from-ink-500 to-sea-900",
  accommodation: "from-olive-500 to-sea-700",
  sport: "from-sea-500 to-olive-500",
  other: "from-sea-600 to-sea-900",
};

export function PlaceCard({
  place,
  scheduled,
}: {
  place: Place;
  scheduled: boolean;
}) {
  const category = PLACE_CATEGORIES[place.category] ?? PLACE_CATEGORIES.other;

  return (
    <Link
      href={`/places/${place.id}`}
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
          <div
            className={`absolute inset-0 bg-gradient-to-br ${
              CATEGORY_TONES[place.category] ?? CATEGORY_TONES.other
            }`}
          >
            <span className="absolute inset-0 flex items-center justify-center text-5xl opacity-75">
              {category.emoji}
            </span>
          </div>
        )}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-sea-950/60 to-transparent"
        />
        {/* Category chip */}
        <span className="absolute right-3 top-3 rounded-full bg-cream-50/90 px-3 py-1 text-xs font-semibold text-ink-700 backdrop-blur">
          {category.emoji} {category.label}
        </span>
        {place.favorite && (
          <span className="absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-cream-50/90 backdrop-blur">
            <Heart size={15} className="fill-terra-500 text-terra-500" />
          </span>
        )}
        {/* Name over image */}
        <div className="absolute inset-x-0 bottom-0 px-4 pb-2.5">
          <h3 className="truncate font-display text-xl font-bold text-cream-50">
            {place.name}
          </h3>
        </div>
      </div>
      <div className="flex items-center justify-between px-4 py-2.5">
        <p className="truncate text-sm text-ink-500">
          {place.area || category.label}
        </p>
        {scheduled ? (
          <span className="flex items-center gap-1 rounded-full bg-sea-100 px-2.5 py-1 text-xs font-semibold text-sea-700">
            <CalendarCheck size={12} />
            בלוח
          </span>
        ) : (
          <span className="rounded-full bg-lemon-100 px-2.5 py-1 text-xs font-medium text-ink-500">
            עוד לא שובץ
          </span>
        )}
      </div>
    </Link>
  );
}
