import { colors, radius } from "@together/shared/tokens";
import { ChevronRight, type LucideIcon } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon } from "@/components/ui/Icon";
import { Text } from "@/components/ui/Text";

/** A titled group of rows on one paper surface. */
export function Group({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      {title ? <Text variant="title">{title}</Text> : null}
      <View style={styles.surface}>{children}</View>
    </View>
  );
}

/** One tappable row: icon, label, description, chevron. */
export function Row({
  icon,
  label,
  description,
  onPress,
  tone = colors.ink700,
  last = false,
  trailing,
}: {
  icon: LucideIcon;
  label: string;
  description?: string;
  onPress?: () => void;
  tone?: string;
  last?: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, !last && styles.divider, pressed && { backgroundColor: colors.chart100 }]}
    >
      <View style={styles.icon}>
        <Icon icon={icon} size={18} color={tone} />
      </View>
      <View style={{ flex: 1 }}>
        <Text weight="medium" color={tone === colors.ink700 ? colors.ink900 : tone} numberOfLines={1}>
          {label}
        </Text>
        {description ? (
          <Text variant="small" color={colors.ink500} numberOfLines={2}>
            {description}
          </Text>
        ) : null}
      </View>
      {trailing ?? (onPress ? <Icon icon={ChevronRight} size={16} color={colors.ink300} flip /> : null)}
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  surface: {
    backgroundColor: colors.paper,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.chart200,
    overflow: "hidden",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 64, paddingHorizontal: 16, paddingVertical: 12 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.chart200 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.chart200,
    alignItems: "center",
    justifyContent: "center",
  },
});
