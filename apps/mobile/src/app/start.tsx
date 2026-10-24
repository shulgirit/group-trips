import { colors, radius } from "@together/shared/tokens";
import { router } from "expo-router";
import { ChevronLeft, ListChecks, Sparkles, type LucideIcon } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { type TKey, useT } from "@/lib/i18n";

/** New trip: let the AI plan it from a sentence, or enter the details yourself. */
export default function Start() {
  const t = useT();
  const option = (icon: LucideIcon, title: TKey, text: TKey, href: "/plan" | "/new", primary = false) => (
    <Pressable accessibilityRole="button" onPress={() => router.replace(href)} style={({ pressed }) => (pressed ? { opacity: 0.9 } : undefined)}>
      <Card style={[styles.card, primary && styles.primary]}>
        <View style={[styles.badge, primary && { backgroundColor: colors.brass500 }]}>
          <Icon icon={icon} size={22} color={primary ? colors.night950 : colors.ink700} />
        </View>
        <Text variant="title" color={primary ? colors.chart50 : colors.ink900}>
          {t(title)}
        </Text>
        <Text variant="small" color={primary ? "rgba(241,243,239,0.8)" : colors.ink500}>
          {t(text)}
        </Text>
      </Card>
    </Pressable>
  );
  return (
    <Screen>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} onPress={() => router.back()} style={styles.back}>
        <Icon icon={ChevronLeft} size={24} color={colors.ink900} />
      </Pressable>
      <Text variant="display" style={{ marginBottom: 8 }}>
        {t("creator.planner.startTitle")}
      </Text>
      {option(Sparkles, "creator.planner.planTitle", "creator.planner.planText", "/plan", true)}
      {option(ListChecks, "creator.planner.manualTitle", "creator.planner.manualText", "/new")}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: 44, height: 44, justifyContent: "center", marginStart: -8 },
  card: { padding: 22, gap: 10, marginTop: 14 },
  primary: { backgroundColor: colors.night950, borderColor: colors.night950 },
  badge: { width: 44, height: 44, borderRadius: radius.chip, backgroundColor: colors.chart100, alignItems: "center", justifyContent: "center" },
});
