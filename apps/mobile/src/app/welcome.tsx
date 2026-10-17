import { colors } from "@together/shared/tokens";
import { useConvexAuth } from "convex/react";
import { Redirect, router } from "expo-router";
import { CalendarDays, Link2, Sparkles, UsersRound, type LucideIcon } from "lucide-react-native";
import { useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SignIn } from "@/components/auth/SignIn";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Text } from "@/components/ui/Text";
import { inviteCode } from "@/lib/auth";
import { type TKey, useT } from "@/lib/i18n";

const CARDS: { key: "together" | "guide" | "organized"; icon: LucideIcon }[] = [
  { key: "together", icon: UsersRound },
  { key: "guide", icon: Sparkles },
  { key: "organized", icon: CalendarDays },
];

const MUTED = "rgba(241,243,239,0.72)";

/** First run: three swipeable cards on the night ground, then sign-in. */
export default function Welcome() {
  const t = useT();
  const { isAuthenticated } = useConvexAuth();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const [signingIn, setSigningIn] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState("");
  const [inviteError, setInviteError] = useState("");
  const list = useRef<FlatList<(typeof CARDS)[number]>>(null);

  if (isAuthenticated) return <Redirect href="/trips" />;

  function openInvite() {
    const code = inviteCode(invite);
    if (!code) {
      setInviteError(t("landing.app.inviteInvalid"));
      return;
    }
    router.push(`/j/${code}`);
  }

  function next() {
    if (page < CARDS.length - 1) list.current?.scrollToIndex({ index: page + 1, animated: true });
    else setSigningIn(true);
  }

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
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
          <FlatList
            ref={list}
            data={CARDS}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(card) => card.key}
            onMomentumScrollEnd={(event) => setPage(Math.round(event.nativeEvent.contentOffset.x / width))}
            renderItem={({ item }) => (
              <View style={[styles.card, { width }]}>
                <View style={styles.node}>
                  <Icon icon={item.icon} size={40} color={colors.brass300} />
                </View>
                <Text variant="displayLg" color={colors.chart50}>
                  {t(`landing.app.cards.${item.key}.title` as TKey)}
                </Text>
                <Text variant="headline" color={MUTED}>
                  {t(`landing.app.cards.${item.key}.text` as TKey)}
                </Text>
              </View>
            )}
          />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.night950 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  card: { flex: 1, paddingHorizontal: 24, justifyContent: "center", gap: 16 },
  node: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1,
    borderColor: "rgba(176,138,85,0.6)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  footer: { paddingHorizontal: 24, paddingBottom: 12, gap: 16 },
  dots: { flexDirection: "row", gap: 8, justifyContent: "center" },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(241,243,239,0.3)" },
  dotActive: { width: 24, backgroundColor: colors.brass500 },
  signIn: { flex: 1, justifyContent: "center", paddingHorizontal: 24, gap: 28 },
  inviteRow: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "center", padding: 8 },
});
