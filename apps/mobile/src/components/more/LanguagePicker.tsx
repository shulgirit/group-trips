import { LOCALES, LOCALE_LABEL } from "@together/i18n/config";
import { colors, radius } from "@together/shared/tokens";
import { Languages } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon } from "@/components/ui/Icon";
import { Text } from "@/components/ui/Text";
import { useLocale, useT } from "@/lib/i18n";
import { styles as rowStyles } from "./Row";

/** The four-language switcher. Hebrew/Arabic flip the layout (the app reloads once). */
export function LanguagePicker() {
  const t = useT();
  const { locale, setLocale } = useLocale();
  return (
    <View style={[rowStyles.surface, { padding: 16, gap: 12 }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Icon icon={Languages} size={18} color={colors.ink500} />
        <Text weight="medium">{t("common.language.title")}</Text>
      </View>
      <View accessibilityRole="radiogroup" style={styles.grid}>
        {LOCALES.map((option) => {
          const selected = option === locale;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => {
                if (!selected) void setLocale(option);
              }}
              style={[styles.option, selected && styles.selected]}
            >
              <Text variant="small" weight={selected ? "medium" : "regular"} color={selected ? colors.chart50 : colors.ink700} align="center">
                {LOCALE_LABEL[option]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text variant="caption" color={colors.ink500}>
        {t("common.language.hint")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 4, padding: 4, borderRadius: radius.card, backgroundColor: colors.chart50, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: colors.chart200 },
  option: { flexBasis: "48%", flexGrow: 1, minHeight: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  selected: { backgroundColor: colors.ink900 },
});
