import { colors } from "@together/shared/tokens";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon } from "@/components/ui/Icon";
import { glyphIcon } from "@/lib/glyphs";
import { type TKey, useT } from "@/lib/i18n";

/** Icon keys offered for events (stored in event.emoji). Same set as the web. */
export const EVENT_GLYPHS = ["dining", "sun", "waves", "ticket", "car", "hotel", "wine", "mountain", "city", "plane"] as const;

export function GlyphPicker({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const t = useT();
  return (
    <View style={styles.row}>
      {EVENT_GLYPHS.map((option) => {
        const selected = value === option;
        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityLabel={t(`trip.eventForm.glyphs.${option}` as TKey)}
            accessibilityState={{ selected }}
            onPress={() => onChange(selected ? "" : option)}
            style={[styles.item, selected && styles.selected]}
          >
            <Icon icon={glyphIcon(option)} size={18} color={selected ? colors.chart50 : colors.ink500} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  item: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.paper,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.chart200,
  },
  selected: { backgroundColor: colors.ink900, borderColor: colors.ink900 },
});
