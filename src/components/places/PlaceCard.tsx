"use client";

import Image from "next/image";
import Link from "next/link";
import { PLACE_CATEGORIES, type Place } from "@/types";

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
      className="flex items-stretch gap-3 overflow-hidden rounded-3xl border border-cream-200 bg-white shadow-sm transition active:scale-[0.99]"
    >
      <div className="relative h-24 w-24 shrink-0 bg-gradient-to-br from-sea-100 to-sea-200">
        {place.imageUrl ? (
          <Image
            src={place.imageUrl}
            alt=""
            fill
            sizes="96px"
            className="object-cover"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-4xl">
            {category.emoji}
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center py-2 pe-3">
        <div className="flex items-center gap-1.5">
          <h3 className="truncate font-semibold text-ink-900">{place.name}</h3>
          {place.favorite && <span aria-label="מועדף">❤️</span>}
        </div>
        <p className="mt-0.5 text-sm text-ink-500">
          {category.label}
          {place.area ? ` · ${place.area}` : ""}
        </p>
        <div className="mt-1.5">
          <span
            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
              scheduled
                ? "bg-sea-100 text-sea-700"
                : "bg-lemon-100 text-ink-700"
            }`}
          >
            {scheduled ? "📅 בלוח" : "עוד לא שובץ"}
          </span>
        </div>
      </div>
    </Link>
  );
}
