"use client";

import { ChevronRight, GraduationCap } from "lucide-react";
import { OPEN_TOUR_EVENT } from "@/components/tour/TourLauncher";
import { STROKE } from "@/components/ui/Icon";
import { useT } from "@/i18n";

/** More-menu row that replays the onboarding tour. */
export function TourRow() {
  const t = useT();
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_TOUR_EVENT))}
      className="flex w-full items-center gap-4 rounded-2xl border border-cream-200 bg-white px-4 py-3.5 text-start transition active:bg-cream-100"
    >
      <span
        aria-hidden
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cream-200 text-ink-700"
      >
        <GraduationCap size={18} strokeWidth={STROKE} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-ink-900">{t("tour.row.title")}</span>
        <span className="block text-sm text-ink-500">{t("tour.row.description")}</span>
      </span>
      <ChevronRight
        size={16}
        strokeWidth={STROKE}
        aria-hidden
        className="shrink-0 text-ink-300 rtl:rotate-180"
      />
    </button>
  );
}
