import { colors, radius } from "@together/shared/tokens";
import { Pressable, StyleSheet } from "react-native";
import { Text } from "./Text";

export function Chip({ label, active = false, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.chip, active ? styles.active : styles.idle]}
    >
      <Text variant="small" weight="medium" color={active ? colors.chart50 : colors.ink700}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { minHeight: 40, paddingHorizontal: 16, borderRadius: radius.chip, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth * 2 },
  idle: { backgroundColor: colors.paper, borderColor: colors.chart200 },
  active: { backgroundColor: colors.ink900, borderColor: colors.ink900 },
});
