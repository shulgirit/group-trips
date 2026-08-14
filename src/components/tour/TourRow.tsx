"use client";

import { GraduationCap } from "lucide-react";
import { OPEN_TOUR_EVENT } from "@/components/tour/TourLauncher";

/** "עוד" menu row that replays the onboarding tour. */
export function TourRow() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_TOUR_EVENT))}
      className="flex w-full items-center gap-4 rounded-3xl border border-cream-200 bg-white px-4 py-4 text-right transition active:bg-cream-100"
    >
      <span className="text-2xl" aria-hidden>
        🎓
      </span>
      <span className="flex-1">
        <span className="block font-semibold text-ink-900">סיור היכרות</span>
        <span className="block text-sm text-ink-500">
          דקה של הסבר על כל מה שהאפליקציה יודעת
        </span>
      </span>
      <GraduationCap size={18} className="text-ink-300" />
    </button>
  );
}
