import DateTimePicker from "@react-native-community/datetimepicker";
import { colors, radius } from "@together/shared/tokens";
import { useState } from "react";
import { Platform, Pressable, StyleSheet } from "react-native";
import { Text } from "./Text";

const toDate = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  const date = new Date();
  date.setHours(h || 0, m || 0, 0, 0);
  return date;
};
const toHhmm = (date: Date) => `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

/** "HH:mm" with the system time picker (inline compact on iOS, dialog on Android). */
export function TimeField({ value, onChange, label }: { value: string; onChange: (hhmm: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  if (Platform.OS === "ios") {
    return (
      <DateTimePicker
        accessibilityLabel={label}
        mode="time"
        display="compact"
        minuteInterval={5}
        value={toDate(value)}
        onChange={(_, date) => date && onChange(toHhmm(date))}
        style={{ alignSelf: "flex-start" }}
      />
    );
  }
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => setOpen(true)} style={styles.field}>
        <Text variant="headline" style={{ fontVariant: ["tabular-nums"], writingDirection: "ltr" }}>
          {value}
        </Text>
      </Pressable>
      {open && (
        <DateTimePicker
          mode="time"
          is24Hour
          value={toDate(value)}
          onChange={(event, date) => {
            setOpen(false);
            if (event.type === "set" && date) onChange(toHhmm(date));
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    alignSelf: "flex-start",
    minWidth: 110,
    minHeight: 50,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 18,
    borderRadius: radius.field,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.chart200,
    backgroundColor: colors.paper,
  },
});
