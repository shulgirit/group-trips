"use client";

import { useState } from "react";
import { useT } from "@/i18n";

const PRESETS = [30, 60, 90, 120, 180] as const;

/** Duration as quick choices (30 min … 3 h, open-ended) with a custom minutes field. */
export function DurationChips({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (minutes: number | null) => void;
}) {
  const t = useT();
  const isPreset = value === null || (PRESETS as readonly number[]).includes(value);
  const [custom, setCustom] = useState(!isPreset);
  const label = (minutes: number) =>
    minutes >= 60
      ? t("trip.units.hoursShort", { value: +(minutes / 60).toFixed(1) })
      : t("trip.units.minutesShort", { value: minutes });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((minutes) => (
          <button
            key={minutes}
            type="button"
            aria-pressed={!custom && value === minutes}
            onClick={() => {
              setCustom(false);
              onChange(minutes);
            }}
            className={`chip ${!custom && value === minutes ? "chip-active" : ""}`}
          >
            {label(minutes)}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={!custom && value === null}
          onClick={() => {
            setCustom(false);
            onChange(null);
          }}
          className={`chip ${!custom && value === null ? "chip-active" : ""}`}
        >
          {t("trip.eventForm.open")}
        </button>
        <button
          type="button"
          aria-pressed={custom}
          onClick={() => setCustom(true)}
          className={`chip ${custom ? "chip-active" : ""}`}
        >
          {t("trip.eventForm.otherDuration")}
        </button>
      </div>
      {custom && (
        <input
          type="number"
          inputMode="numeric"
          min={5}
          step={5}
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}
          placeholder={t("trip.eventForm.durationMinutes")}
          aria-label={t("trip.eventForm.durationMinutes")}
          className="field"
        />
      )}
    </div>
  );
}
