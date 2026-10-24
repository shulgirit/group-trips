import { colors } from "@together/shared/tokens";
import { Image, type ImageSource } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { ArrowRight, ChevronLeft, ListChecks, Sparkles, type LucideIcon } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { type TKey, useT } from "@/lib/i18n";

/** New trip: let the AI agent plan it from an idea, or set it up yourself when the dates and basics are known. */
export default function Start() {
  const t = useT();
  const card = (image: ImageSource, icon: LucideIcon, tag: TKey, title: TKey, text: TKey, href: "/plan" | "/new", primary: boolean) => (
    <Pressable accessibilityRole="button" accessibilityLabel={t(title)} onPress={() => router.replace(href)} style={({ pressed }) => [styles.card, pressed && { opacity: 0.93, transform: [{ scale: 0.99 }] }]}>
      <Image source={image} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient colors={["rgba(7,12,22,0.15)", "rgba(7,12,22,0.55)", "rgba(7,12,22,0.94)"]} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />
      <View style={[styles.tag, primary && styles.tagPrimary]}>
        <Icon icon={icon} size={14} color={primary ? colors.night950 : colors.chart50} />
        <Text variant="caption" weight="semibold" color={primary ? colors.night950 : colors.chart50}>
          {t(tag)}
        </Text>
      </View>
      <View style={styles.body}>
        <View style={{ flex: 1, gap: 6 }}>
          <Text variant="headline" weight="semibold" color={colors.chart50}>
            {t(title)}
          </Text>
          <Text variant="small" color="rgba(241,243,239,0.82)">
            {t(text)}
          </Text>
        </View>
        <View style={[styles.go, primary && styles.goPrimary]}>
          <Icon icon={ArrowRight} size={20} color={primary ? colors.night950 : colors.chart50} />
        </View>
      </View>
    </Pressable>
  );
  return (
    <Screen>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} onPress={() => router.back()} style={styles.back}>
        <Icon icon={ChevronLeft} size={24} color={colors.ink900} />
      </Pressable>
      <Text variant="display" style={{ marginBottom: 6 }}>
        {t("creator.planner.startTitle")}
      </Text>
      {card(require("../../assets/onboarding/guide.webp"), Sparkles, "creator.planner.planTag", "creator.planner.planTitle", "creator.planner.planText", "/plan", true)}
      {card(require("../../assets/onboarding/plan.webp"), ListChecks, "creator.planner.manualTag", "creator.planner.manualTitle", "creator.planner.manualText", "/new", false)}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: 44, height: 44, justifyContent: "center", marginStart: -8 },
  card: { height: 236, borderRadius: 28, overflow: "hidden", justifyContent: "space-between", padding: 18, backgroundColor: colors.night950, marginTop: 12, shadowColor: colors.ink900, shadowOpacity: 0.2, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
  tag: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: "rgba(241,243,239,0.16)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(241,243,239,0.3)" },
  tagPrimary: { backgroundColor: colors.brass500, borderColor: colors.brass500 },
  body: { flexDirection: "row", alignItems: "flex-end", gap: 14 },
  go: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(241,243,239,0.16)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(241,243,239,0.3)" },
  goPrimary: { backgroundColor: colors.brass500, borderColor: colors.brass500 },
});
