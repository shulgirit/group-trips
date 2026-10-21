import { colors, radius } from "@together/shared/tokens";
import type { LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import { Icon } from "./Icon";
import { Text } from "./Text";

type Tone = "primary" | "brass" | "soft" | "outline" | "danger" | "light" | "ghost";

const TONES: Record<Tone, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.ink900, fg: colors.chart50 },
  brass: { bg: colors.brass500, fg: colors.night950 },
  soft: { bg: colors.chart100, fg: colors.ink700 },
  outline: { bg: colors.paper, fg: colors.ink900, border: colors.chart200 },
  danger: { bg: colors.terra600, fg: colors.paper },
  light: { bg: colors.chart50, fg: colors.night950 },
  /** On the dark Atlas ground */
  ghost: { bg: "transparent", fg: colors.chart50, border: "rgba(241,243,239,0.25)" },
};

export function Button({
  label,
  onPress,
  tone = "primary",
  icon,
  leading,
  busy = false,
  disabled = false,
  size = "md",
  style,
}: {
  label: string;
  onPress: () => void;
  tone?: Tone;
  icon?: LucideIcon;
  /** A custom mark (e.g. a brand logo) before the label */
  leading?: ReactNode;
  busy?: boolean;
  disabled?: boolean;
  size?: "md" | "lg";
  style?: ViewStyle;
}) {
  const t = TONES[tone];
  const off = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: t.bg, minHeight: size === "lg" ? 56 : 48, opacity: off ? 0.5 : 1 },
        t.border && { borderWidth: StyleSheet.hairlineWidth * 2, borderColor: t.border },
        pressed && { transform: [{ scale: 0.985 }] },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={t.fg} />
      ) : (
        <View style={styles.row}>
          {leading}
          {icon && <Icon icon={icon} size={18} color={t.fg} />}
          <Text variant={size === "lg" ? "headline" : "body"} weight="semibold" color={t.fg}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.field, paddingHorizontal: 20, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
});
