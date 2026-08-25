import Image from "next/image";
import type { TripConfig } from "@/lib/trips";

/**
 * Hero background: the trip photo when one exists, otherwise a designed
 * gradient (Sardinia 60 — deep sea with a big birthday "60" + wings).
 * Positioned absolute — parent must be relative with a fixed height.
 */
export function TripHeroBackdrop({ trip }: { trip: TripConfig }) {
  if (trip.heroImage) {
    return (
      <Image
        src={trip.heroImage}
        alt=""
        fill
        priority
        sizes="(max-width: 768px) 100vw, 576px"
        className="object-cover"
      />
    );
  }
  return (
    <div
      aria-hidden
      className="absolute inset-0 overflow-hidden bg-gradient-to-br from-sea-950 via-sea-700 to-sea-500"
    >
      <div className="absolute -left-16 top-8 h-64 w-64 rounded-full bg-lemon-400/15 blur-3xl" />
      <div className="absolute -right-12 bottom-14 h-72 w-72 rounded-full bg-sea-400/25 blur-3xl" />
      <span className="absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 select-none font-display text-[10rem] font-bold leading-none text-cream-50/10">
        60
      </span>
      <span className="absolute left-1/2 top-[16%] -translate-x-1/2 text-5xl drop-shadow-lg">
        ✈️
      </span>
    </div>
  );
}
