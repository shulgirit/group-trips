import { colors } from "@together/shared/tokens";
import { useConvexAuth } from "convex/react";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { Link2 } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SignIn } from "@/components/auth/SignIn";
import { Logo } from "@/components/brand/Logo";
import { OnboardingCopy, OnboardingPage, type OnboardingKey } from "@/components/onboarding/OnboardingPage";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Text } from "@/components/ui/Text";
import { inviteCode } from "@/lib/auth";
import { useLocale, useT } from "@/lib/i18n";

const CARDS: { key: OnboardingKey }[] = [{ key: "together" }, { key: "guide" }, { key: "organized" }];

const MUTED = "rgba(241,243,239,0.72)";

/** First run: three swipeable cards on the night ground, then sign-in. */
export default function Welcome() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { rtl } = useLocale();
  const { preview } = useLocalSearchParams<{ preview?: string }>();
  const { isAuthenticated } = useConvexAuth();
  const [page, setPage] = useState(0);
  const [signingIn, setSigningIn] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState("");
  const [inviteError, setInviteError] = useState("");

  // A state-driven pager (no scroll view: scroll offsets and right-to-left layouts disagree on devices).
  // Swiping toward the "next" side advances: left in LTR, right in RTL.
  const swipe = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-24, 24])
    .onEnd((event) => {
      const forward = rtl ? event.translationX > 40 : event.translationX < -40;
      const back = rtl ? event.translationX < -40 : event.translationX > 40;
      if (forward && page < CARDS.length - 1) setPage(page + 1);
      else if (back && page > 0) setPage(page - 1);
    });

  // ?preview=1 (dev builds only) shows this screen even when signed in, for visual checks
  if (isAuthenticated && !(__DEV__ && preview)) return <Redirect href="/trips" />;

  function openInvite() {
    const code = inviteCode(invite);
    if (!code) {
      setInviteError(t("landing.app.inviteInvalid"));
      return;
    }
    router.push(`/j/${code}`);
  }

  function next() {
    if (page < CARDS.length - 1) setPage(page + 1);
    else setSigningIn(true);
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {!signingIn && (
        <Animated.View key={`art-${CARDS[page].key}`} entering={FadeIn.duration(350)} style={StyleSheet.absoluteFill} pointerEvents="none">
          <OnboardingPage page={CARDS[page].key} />
        </Animated.View>
      )}
      <View style={styles.header}>
        <Logo color={colors.chart50} />
        {!signingIn && (
          <Pressable accessibilityRole="button" onPress={() => setSigningIn(true)} hitSlop={12}>
            <Text variant="small" color={MUTED}>
              {t("landing.app.skip")}
            </Text>
          </Pressable>
        )}
      </View>

      {signingIn ? (
        <View style={styles.signIn}>
          <View style={{ gap: 10 }}>
            <Text variant="display" color={colors.chart50}>
              {t("landing.app.signInTitle")}
            </Text>
            <Text variant="headline" color={MUTED}>
              {t("landing.app.signInText")}
            </Text>
          </View>
          <SignIn onSignedIn={() => router.replace("/trips")} />
          {inviteOpen ? (
            <View style={{ gap: 8 }}>
              <Field
                value={invite}
                onChangeText={(value) => {
                  setInvite(value);
                  setInviteError("");
                }}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder={t("landing.app.invitePlaceholder")}
                onSubmitEditing={openInvite}
                style={{ writingDirection: "ltr", textAlign: "left" }}
              />
              {inviteError ? (
                <Text variant="small" color={colors.brass300}>
                  {inviteError}
                </Text>
              ) : null}
              <Button tone="ghost" label={t("landing.app.inviteGo")} onPress={openInvite} />
            </View>
          ) : (
            <Pressable accessibilityRole="button" onPress={() => setInviteOpen(true)} style={styles.inviteRow}>
              <Icon icon={Link2} size={18} color={MUTED} />
              <Text variant="body" color={MUTED}>
                {t("landing.app.haveInvite")}
              </Text>
            </Pressable>
          )}
        </View>
      ) : (
        <>
          <GestureDetector gesture={swipe}>
            <View key={CARDS[page].key} style={styles.card}>
              <OnboardingCopy page={CARDS[page].key} />
            </View>
          </GestureDetector>
          <View style={styles.footer}>
            <View style={styles.dots} accessibilityLabel={t("landing.app.stepOf", { n: page + 1, total: CARDS.length })}>
              {CARDS.map((card, index) => (
                <View key={card.key} style={[styles.dot, index === page && styles.dotActive]} />
              ))}
            </View>
            <Button tone="light" size="lg" label={page < CARDS.length - 1 ? t("landing.app.next") : t("landing.app.start")} onPress={next} />
            <Pressable accessibilityRole="button" onPress={() => { setSigningIn(true); setInviteOpen(true); }} style={{ alignSelf: "center", padding: 8 }}>
              <Text variant="small" color={MUTED}>
                {t("landing.app.haveInvite")}
              </Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.night950 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  card: { flex: 1, paddingHorizontal: 24, justifyContent: "flex-end", paddingBottom: 20 },
  footer: { paddingHorizontal: 24, paddingBottom: 12, gap: 16 },
  dots: { flexDirection: "row", gap: 8, justifyContent: "center" },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(241,243,239,0.3)" },
  dotActive: { width: 24, backgroundColor: colors.brass500 },
  signIn: { flex: 1, justifyContent: "center", paddingHorizontal: 24, gap: 28 },
  inviteRow: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "center", padding: 8 },
});
