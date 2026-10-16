"use client";

import { Glyph } from "@/components/ui/Icon";
import { useT } from "@/i18n";

/** Icon keys offered for events (stored in event.emoji, rendered by <Glyph>). */
export const EVENT_GLYPH_OPTIONS = [
  "dining",
  "sun",
  "waves",
  "ticket",
  "car",
  "hotel",
  "wine",
  "mountain",
  "city",
  "plane",
] as const;

export function EventGlyphPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const t = useT();
  return (
    <div className="flex flex-wrap gap-2">
      {EVENT_GLYPH_OPTIONS.map((option) => {
        const selected = value === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(selected ? "" : option)}
            aria-label={t(`trip.eventForm.glyphs.${option}`)}
            aria-pressed={selected}
            className={`flex h-11 w-11 items-center justify-center rounded-full border transition ${
              selected
                ? "border-sea-900 bg-sea-900 text-cream-50"
                : "border-cream-200 bg-white text-ink-500"
            }`}
          >
            <Glyph value={option} size={18} />
          </button>
        );
      })}
    </div>
  );
}
