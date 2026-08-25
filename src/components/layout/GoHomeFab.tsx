"use client";

import { usePathname } from "next/navigation";
import { Home } from "lucide-react";
import { useHomeBase } from "@/lib/hooks";
import { wazeUrl } from "@/lib/nav";
import { useTrip } from "@/components/providers/TripProvider";

/** Floating "navigate home" button — one tap opens Waze to the trip's
 *  home base (the "villa" place, or the first accommodation added, or
 *  the config fallback). Hidden while the trip has no home base. */
export function GoHomeFab() {
  const pathname = usePathname();
  const trip = useTrip();
  const { home } = useHomeBase();

  // The chat input owns the bottom edge on the concierge screen
  if (pathname.startsWith(`${trip.prefix}/ai`)) return null;

  const target = home ?? trip.homeBase;
  if (!target) return null;

  return (
    <a
      href={wazeUrl(target, trip.searchRegionHint)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={trip.homeBase?.navAria ?? "נווט הביתה"}
      className="fixed bottom-[calc(7rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sea-500 to-sea-700 text-cream-50 shadow-[var(--shadow-float)] transition active:scale-95"
    >
      <Home size={24} strokeWidth={2.2} />
    </a>
  );
}
