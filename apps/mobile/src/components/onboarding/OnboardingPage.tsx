import { colors } from "@together/shared/tokens";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { CalendarDays, Link2, Wallet } from "lucide-react-native";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, FadeInDown, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { GuideAvatar } from "@/components/trips/GuideAvatar";
import { Icon } from "@/components/ui/Icon";
import { Text } from "@/components/ui/Text";
import { type TKey, useT } from "@/lib/i18n";

export type OnboardingKey = "together" | "guide" | "organized";

const ART: Record<OnboardingKey, number> = {
  together: require("../../../assets/onboarding/group.webp"),
  guide: require("../../../assets/onboarding/guide.webp"),
  organized: require("../../../assets/onboarding/plan.webp"),
};

const MUTED = "rgba(241,243,239,0.78)";
const GLASS = "rgba(11,19,34,0.58)";
const GLASS_BORDER = "rgba(255,255,255,0.14)";
const FACES = ["A", "S", "J", "R", "M"];
const FACE_TINT = ["#b08a55", "#4f7f7a", "#9c5a43", "#6b7fa8", "#8a8f52"];

/** A frosted card (translucent: the native blur module is not part of this build). */
function Glass({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.glass, style]}>{children}</View>;
}

/** Full-bleed artwork with a slow push-in, a dark floor for the text, and a page-specific hero. */
export function OnboardingPage({ page }: { page: OnboardingKey }) {
  const t = useT();
  const zoom = useSharedValue(1.14);
  useEffect(() => {
    zoom.value = withTiming(1, { duration: 7000, easing: Easing.out(Easing.cubic) });
  }, [zoom]);
  const push = useAnimatedStyle(() => ({ transform: [{ scale: zoom.value }] }));

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, push]}>
        <Image source={ART[page]} style={StyleSheet.absoluteFill} contentFit="cover" />
      </Animated.View>
      <LinearGradient
        colors={["rgba(7,12,22,0.55)", "rgba(7,12,22,0)", "rgba(7,12,22,0.78)", colors.night950]}
        locations={[0, 0.3, 0.68, 0.9]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* hero: lives in the upper-middle of the screen */}
      <View style={[styles.hero, page === "together" && styles.heroTop]} pointerEvents="none">
        {page === "together" && (
          <Animated.View entering={FadeInDown.delay(250).duration(500)} style={styles.row}>
            <View style={styles.faces}>
              {FACES.map((letter, i) => (
                <Animated.View key={letter} entering={FadeInDown.delay(300 + i * 90).duration(450)} style={[styles.face, { backgroundColor: FACE_TINT[i], marginStart: i === 0 ? 0 : -12 }]}>
                  <Text variant="small" weight="semibold" color="#fff">
                    {letter}
                  </Text>
                </Animated.View>
              ))}
            </View>
            <Glass style={styles.chip}>
              <Icon icon={Link2} size={16} color={colors.brass300} />
              <Text variant="small" weight="medium" color={colors.chart50}>
                {t("landing.app.demo.invite")}
              </Text>
            </Glass>
          </Animated.View>
        )}

        {page === "guide" && (
          <View style={{ alignItems: "center", gap: 18 }}>
            <Animated.View entering={FadeInDown.duration(600)} style={styles.glow}>
              <GuideAvatar avatar="bot:butler" emoji="butler" size={124} />
            </Animated.View>
            <View style={{ alignSelf: "stretch", gap: 8 }}>
              <Animated.View entering={FadeInDown.delay(500).duration(450)} style={[styles.bubble, styles.bubbleUser]}>
                <Text variant="small" weight="medium" color={colors.night950}>
                  {t("landing.app.demo.ask")}
                </Text>
              </Animated.View>
              <Animated.View entering={FadeInDown.delay(950).duration(450)} style={[styles.bubble, styles.bubbleBot]}>
                <Text variant="small" color={colors.chart50}>
                  {t("landing.app.demo.reply")}
                </Text>
              </Animated.View>
            </View>
          </View>
        )}

        {page === "organized" && (
          <View style={{ gap: 10 }}>
            <Animated.View entering={FadeInDown.delay(300).duration(450)}>
              <Glass style={styles.mini}>
                <Icon icon={CalendarDays} size={18} color={colors.brass300} />
                <Text variant="small" weight="semibold" color={colors.chart50} style={{ writingDirection: "ltr" }}>
                  11:00
                </Text>
                <Text variant="small" color={MUTED} style={{ flex: 1 }}>
                  Tate Modern
                </Text>
              </Glass>
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(650).duration(450)}>
              <Glass style={styles.mini}>
                <Icon icon={Wallet} size={18} color={colors.brass300} />
                <Text variant="small" color={MUTED} style={{ flex: 1 }}>
                  {t("landing.app.demo.owes")}
                </Text>
                <Text variant="small" weight="semibold" color={colors.chart50} style={{ writingDirection: "ltr" }}>
                  £61
                </Text>
              </Glass>
            </Animated.View>
          </View>
        )}
      </View>

    </View>
  );
}

/** Headline + line under it, sitting on the dark floor of the artwork. */
export function OnboardingCopy({ page }: { page: OnboardingKey }) {
  const t = useT();
  return (
    <Animated.View entering={FadeInDown.delay(150).duration(520)} style={{ gap: 10 }}>
      <Text variant="displayLg" color={colors.chart50}>
        {t(`landing.app.cards.${page}.title` as TKey)}
      </Text>
      <Text variant="headline" color={MUTED}>
        {t(`landing.app.cards.${page}.text` as TKey)}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  glass: { backgroundColor: GLASS, borderColor: GLASS_BORDER, borderWidth: StyleSheet.hairlineWidth * 2, borderRadius: 18 },
  hero: { position: "absolute", left: 24, right: 24, top: "20%", bottom: "42%", justifyContent: "flex-end" },
  heroTop: { top: "15%", bottom: undefined, justifyContent: "flex-start" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  faces: { flexDirection: "row", alignItems: "center" },
  face: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: colors.night950, alignItems: "center", justifyContent: "center" },
  chip: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999 },
  glow: { shadowColor: colors.brass500, shadowOpacity: 0.85, shadowRadius: 36, shadowOffset: { width: 0, height: 0 } },
  bubble: { maxWidth: "86%", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  bubbleUser: { alignSelf: "flex-end", backgroundColor: colors.chart50 },
  bubbleBot: { alignSelf: "flex-start", backgroundColor: GLASS, borderColor: GLASS_BORDER, borderWidth: StyleSheet.hairlineWidth * 2 },
  mini: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
});
