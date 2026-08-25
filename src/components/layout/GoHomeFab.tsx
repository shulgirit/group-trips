"use client";

import { usePathname } from "next/navigation";
import { Home } from "lucide-react";
import { usePlace } from "@/lib/hooks";
import { wazeUrl } from "@/lib/nav";
import { useTrip } from "@/components/providers/TripProvider";

/** Floating "navigate home" button — one tap opens Waze to the trip's
 *  home base (the place with the fixed id "villa", or the config
 *  fallback). Hidden when the trip has no home base yet. */
export function GoHomeFab() {
  const pathname = usePathname();
  const trip = useTrip();
  const { place } = usePlace("villa");

  // The chat input owns the bottom edge on the concierge screen
  if (pathname.startsWith(`${trip.prefix}/ai`)) return null;

  const target = place ?? trip.homeBase;
  if (!target) return null;

  return (
    <a
      href={wazeUrl(target)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={trip.homeBase?.navAria ?? "נווט הביתה"}
      className="fixed bottom-[calc(7rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sea-500 to-sea-700 text-cream-50 shadow-[var(--shadow-float)] transition active:scale-95"
    >
      <Home size={24} strokeWidth={2.2} />
    </a>
  );
}
