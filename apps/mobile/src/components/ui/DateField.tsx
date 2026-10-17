import DateTimePicker from "@react-native-community/datetimepicker";
import { formatShortDate } from "@together/i18n/format";
import { colors, radius } from "@together/shared/tokens";
import { useState } from "react";
import { Platform, Pressable, StyleSheet } from "react-native";
import { Text } from "./Text";

const toDate = (iso: string) => (iso ? new Date(`${iso}T12:00:00`) : new Date());
const toIso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/** "YYYY-MM-DD" with the system date picker (inline compact on iOS, dialog on Android). */
export function DateField({
  value,
  onChange,
  label,
  min,
  placeholder = "—",
}: {
  value: string;
  onChange: (iso: string) => void;
  label: string;
  min?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const minimumDate = min ? toDate(min) : undefined;
  if (Platform.OS === "ios" && value) {
    return (
      <DateTimePicker
        accessibilityLabel={label}
        mode="date"
        display="compact"
        value={toDate(value)}
        minimumDate={minimumDate}
        onChange={(_, date) => date && onChange(toIso(date))}
        style={{ alignSelf: "flex-start" }}
      />
    );
  }
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => setOpen(true)} style={styles.field}>
        <Text color={value ? colors.ink900 : colors.ink400} style={{ fontVariant: ["tabular-nums"], writingDirection: "ltr" }}>
          {value ? formatShortDate(value) : placeholder}
        </Text>
      </Pressable>
      {open &&
        (Platform.OS === "ios" ? (
          <DateTimePicker
            mode="date"
            display="inline"
            value={minimumDate ?? new Date()}
            minimumDate={minimumDate}
            onChange={(_, date) => {
              setOpen(false);
              if (date) onChange(toIso(date));
            }}
          />
        ) : (
          <DateTimePicker
            mode="date"
            value={toDate(value || min || "")}
            minimumDate={minimumDate}
            onChange={(event, date) => {
              setOpen(false);
              if (event.type === "set" && date) onChange(toIso(date));
            }}
          />
        ))}
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: 46,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: radius.field,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.chart200,
    backgroundColor: colors.paper,
  },
});
