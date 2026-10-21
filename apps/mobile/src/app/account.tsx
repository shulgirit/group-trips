import { api } from "@together/backend/api";
import { colors } from "@together/shared/tokens";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Image } from "expo-image";
import { Redirect, Stack, router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { FileText, LayoutGrid, LogOut, Mail, ShieldCheck, UserRound } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from "react-native";
import { SignIn } from "@/components/auth/SignIn";
import { LanguagePicker } from "@/components/more/LanguagePicker";
import { LEGAL_URL } from "@/components/more/links";
import { Group, Row, styles as rowStyles } from "@/components/more/Row";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { signOut } from "@/lib/auth";
import { useT } from "@/lib/i18n";

/** My account: profile, my trips, language, legal, sign out and account deletion (App Store 5.1.1). */
export default function Account() {
  const t = useT();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const me = useQuery(api.account.me, isAuthenticated ? {} : "skip");
  const setName = useMutation(api.account.setName);
  const [name, setNameValue] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!isLoading && !isAuthenticated) return <Redirect href="/welcome" />;

  async function saveName() {
    if (name === null || !name.trim() || savingName) return;
    setSavingName(true);
    try {
      await setName({ name });
      setNameValue(null);
    } finally {
      setSavingName(false);
    }
  }

  async function handleSignOut() {
    setBusy(true);
    await signOut().catch(() => undefined);
    router.replace("/welcome");
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t("product.account.title"), headerShadowVisible: false, headerStyle: { backgroundColor: colors.chart50 }, headerBackButtonDisplayMode: "minimal", headerTintColor: colors.ink900 }} />
      <Screen edges={[]}>
        {me === undefined ? (
          <ActivityIndicator color={colors.ink500} style={{ marginTop: 32 }} />
        ) : me === null ? null : me.guest ? (
          /* A guest device: sign in to keep the trips (the guest seats move to the account) */
          <View style={{ backgroundColor: colors.night950, borderRadius: 24, padding: 20, gap: 16 }}>
            <Text variant="title" color={colors.chart50}>
              {t("product.trips.guestNote")}
            </Text>
            <SignIn />
          </View>
        ) : (
          <>
            {/* Profile */}
            <View style={[rowStyles.surface, { padding: 16, gap: 12 }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                <View style={styles.avatar}>
                  {me.image ? (
                    <Image source={me.image} style={StyleSheet.absoluteFill} contentFit="cover" />
                  ) : me.name ? (
                    <Text variant="headline" weight="medium" color={colors.ink700}>
                      {me.name.slice(0, 1)}
                    </Text>
                  ) : (
                    <Icon icon={UserRound} size={24} color={colors.ink500} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Pressable accessibilityRole="button" accessibilityLabel={t("product.trips.nameTitle")} onPress={() => setNameValue(me.name ?? "")}>
                    <Text variant="headline" weight="medium" numberOfLines={1}>
                      {me.name || t("product.trips.nameTitle")}
                    </Text>
                  </Pressable>
                  <Text variant="small" color={colors.ink500} numberOfLines={1} style={{ writingDirection: "ltr" }}>
                    {me.email}
                  </Text>
                </View>
              </View>
              {name !== null && (
                <View style={{ gap: 8 }}>
                  <Field value={name} onChangeText={setNameValue} autoFocus autoComplete="name" textContentType="name" placeholder={t("product.trips.namePlaceholder")} onSubmitEditing={saveName} />
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Button label={t("product.trips.nameSave")} onPress={saveName} busy={savingName} disabled={!name.trim()} style={{ flex: 1 }} />
                    <Button tone="soft" label={t("common.cancel")} onPress={() => setNameValue(null)} />
                  </View>
                </View>
              )}
            </View>

            <Group>
              <Row icon={LayoutGrid} label={t("settings.more.myTrips")} description={t("settings.more.myTripsDescription")} onPress={() => router.replace("/trips")} last />
            </Group>

            <View style={{ gap: 10 }}>
              <Text variant="title">{t("settings.accountPage.preferences")}</Text>
              <LanguagePicker />
            </View>

            <Group title={t("product.account.yourData")}>
              <Row icon={ShieldCheck} label={t("product.account.privacyLink")} onPress={() => WebBrowser.openBrowserAsync(`${LEGAL_URL}/privacy`)} />
              <Row icon={FileText} label={t("product.account.termsLink")} onPress={() => WebBrowser.openBrowserAsync(`${LEGAL_URL}/terms`)} />
              <Row icon={Mail} label={t("product.account.contactSupport")} description="support@togethergroup.app" onPress={() => Linking.openURL("mailto:support@togethergroup.app")} />
              <Row icon={LogOut} label={busy ? t("settings.logout.busy") : t("settings.logout.title")} description={t("settings.logout.description")} onPress={busy ? undefined : handleSignOut} last />
            </Group>

            <Pressable accessibilityRole="button" onPress={() => router.push("/account-delete")} hitSlop={8} style={{ alignSelf: "center", paddingVertical: 12 }}>
              <Text variant="small" color={colors.terra600} style={{ textDecorationLine: "underline" }}>
                {t("product.account.deleteTitle")}
              </Text>
            </Pressable>
          </>
        )}
      </Screen>

    </>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 56, height: 56, borderRadius: 28, overflow: "hidden", backgroundColor: colors.chart100, alignItems: "center", justifyContent: "center" },
});
