"use client";

import { usePathname } from "next/navigation";
import { Home } from "lucide-react";
import { usePlace } from "@/lib/hooks";
import { wazeUrl } from "@/lib/nav";
import { TRIP } from "@/lib/trip";

/** Floating "navigate home to the villa" button — one tap opens Waze. */
export function GoHomeFab() {
  const pathname = usePathname();
  const { place } = usePlace("villa");

  // The chat input owns the bottom edge on the concierge screen
  if (pathname.startsWith("/ai")) return null;

  const target = place ?? TRIP.villa;

  return (
    <a
      href={wazeUrl(target)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="נווט הביתה לוילה"
      className="fixed bottom-[calc(7rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sea-500 to-sea-700 text-cream-50 shadow-[var(--shadow-float)] transition active:scale-95"
    >
      <Home size={24} strokeWidth={2.2} />
    </a>
  );
}
