import { useState } from "react";
import { View } from "react-native";
import { Chip } from "@/components/ui/Chip";
import { ChipRow } from "@/components/ui/ChipRow";
import { Field } from "@/components/ui/Field";
import { useT } from "@/lib/i18n";

const PRESETS = [30, 60, 90, 120, 180] as const;

/** Duration as quick choices (30 min … 3 h, open-ended) with a custom minutes field. */
export function DurationChips({ value, onChange }: { value: number | null; onChange: (minutes: number | null) => void }) {
  const t = useT();
  const [custom, setCustom] = useState(!(value === null || (PRESETS as readonly number[]).includes(value)));
  const label = (minutes: number) =>
    minutes >= 60 ? t("trip.units.hoursShort", { value: +(minutes / 60).toFixed(1) }) : t("trip.units.minutesShort", { value: minutes });
  return (
    <View style={{ gap: 8 }}>
      <ChipRow>
        {PRESETS.map((minutes) => (
          <Chip
            key={minutes}
            label={label(minutes)}
            active={!custom && value === minutes}
            onPress={() => {
              setCustom(false);
              onChange(minutes);
            }}
          />
        ))}
        <Chip
          label={t("trip.eventForm.open")}
          active={!custom && value === null}
          onPress={() => {
            setCustom(false);
            onChange(null);
          }}
        />
        <Chip label={t("trip.eventForm.otherDuration")} active={custom} onPress={() => setCustom(true)} />
      </ChipRow>
      {custom && (
        <Field
          keyboardType="number-pad"
          value={value ? String(value) : ""}
          onChangeText={(text) => onChange(text ? Number(text.replace(/\D/g, "")) || null : null)}
          placeholder={t("trip.eventForm.durationMinutes")}
          accessibilityLabel={t("trip.eventForm.durationMinutes")}
        />
      )}
    </View>
  );
}
