import { colors } from "@together/shared/tokens";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/Text";
import { useT } from "@/lib/i18n";

type TimeLeft = { days: number; hours: number; minutes: number; seconds: number };

function left(target: number): TimeLeft | null {
  const diff = target - Date.now();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff / 3_600_000) % 24),
    minutes: Math.floor((diff / 60_000) % 60),
    seconds: Math.floor((diff / 1_000) % 60),
  };
}

/**
 * Days · hours · min · sec until departure. Clock order — days LEFTMOST in
 * every language (Omer's call), so the row is pinned to LTR.
 */
export function Countdown({ targetIso }: { targetIso: string }) {
  const t = useT();
  const target = new Date(targetIso).getTime();
  const [time, setTime] = useState(() => left(target));
  useEffect(() => {
    const interval = setInterval(() => setTime(left(target)), 1_000);
    return () => clearInterval(interval);
  }, [target]);
  if (!time) return null;
  const units = [
    { id: "days", value: time.days, label: t("trip.countdown.days") },
    { id: "hours", value: time.hours, label: t("trip.countdown.hours") },
    { id: "minutes", value: time.minutes, label: t("trip.countdown.minutes") },
    { id: "seconds", value: time.seconds, label: t("trip.countdown.seconds") },
  ];
  return (
    <View style={styles.row} accessibilityRole="timer">
      {units.map((unit, index) => (
        <View key={unit.id} style={[styles.unit, index > 0 && styles.divider]}>
          <Text variant="display" color={colors.chart50} align="center" numberOfLines={1} style={{ fontVariant: ["tabular-nums"] }}>
            {String(unit.value).padStart(unit.id === "days" ? 1 : 2, "0")}
          </Text>
          <Text variant="caption" color="rgba(241,243,239,0.75)" align="center">
            {unit.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", direction: "ltr", alignSelf: "flex-start" },
  // minWidth, not width: a 3-digit day count (179) must grow its column instead of wrapping to a second line
  unit: { minWidth: 72, paddingHorizontal: 8, gap: 4, alignItems: "center" },
  divider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: "rgba(241,243,239,0.25)" },
});
