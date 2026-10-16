import Image from "next/image";
import type { TripConfig } from "@/lib/trips";
import { Glyph } from "@/components/ui/Icon";

/**
 * Hero background: the trip photo when one exists, otherwise a designed
 * quiet ink field with the trip's big glyph (e.g. Sardinia's "60").
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
      className="absolute inset-0 overflow-hidden bg-sea-950"
    >
      {trip.heroArt?.big && (
        <span className="absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 select-none font-mark text-[10rem] font-extralight leading-none text-cream-50/10">
          {trip.heroArt.big}
        </span>
      )}
      {trip.heroArt?.icon && (
        <span className="absolute left-1/2 top-[16%] -translate-x-1/2 text-lemon-200/80">
          <Glyph value={trip.heroArt.icon} size={40} />
        </span>
      )}
    </div>
  );
}
