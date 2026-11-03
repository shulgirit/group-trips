import { colors, radius } from "@together/shared/tokens";
import { useConvexAuth } from "convex/react";
import { Redirect, Stack, router } from "expo-router";
import { Dot, TriangleAlert } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { authClient } from "@/lib/convex";
import { useT } from "@/lib/i18n";

/** Permanent account deletion: a full page (not a pop-up) with everything that will be lost. */
export default function AccountDelete() {
  const t = useT();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const word = t("common.confirm.word");
  const armed = typed.trim().toUpperCase() === word.toUpperCase();

  if (!isLoading && !isAuthenticated) return <Redirect href="/welcome" />;

  async function deleteAccount() {
    if (!armed || busy) return;
    setBusy(true);
    setError("");
    try {
      // Trips pass to another organizer (or are deleted) on the server first
      const result = await authClient.deleteUser();
      if (result.error) throw new Error(result.error.code ?? "delete_failed");
      await authClient.signOut().catch(() => undefined);
      router.replace("/welcome");
    } catch {
      setError(t("product.account.deleteFailed"));
      setBusy(false);
    }
  }

  const items = [
    t("product.account.items.profile"),
    t("product.account.items.chats"),
    t("product.account.items.documents"),
    t("product.account.items.location"),
    t("product.account.items.trips"),
    t("product.account.items.shared"),
  ];

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t("product.account.deleteTitle"), headerShadowVisible: false, headerStyle: { backgroundColor: colors.chart50 }, headerBackButtonDisplayMode: "minimal", headerTintColor: colors.ink900 }} />
      <Screen edges={[]}>
        <View style={styles.warning}>
          <Icon icon={TriangleAlert} size={22} color={colors.terra600} />
          <Text variant="headline" weight="semibold" color={colors.terra600} style={{ flex: 1 }}>
            {t("product.account.permanent")}
          </Text>
        </View>
        <Text variant="title">{t("product.account.dialogTitle")}</Text>
        <Text color={colors.ink700}>{t("product.account.dialogText")}</Text>
        <View style={{ gap: 8 }}>
          {items.map((item) => (
            <View key={item} style={{ flexDirection: "row", gap: 4 }}>
              <Icon icon={Dot} size={18} color={colors.terra600} />
              <Text color={colors.ink700} style={{ flex: 1 }}>
                {item}
              </Text>
            </View>
          ))}
        </View>
        <Text weight="medium" color={colors.terra600}>
          {t("common.confirm.irreversible")}
        </Text>
        <View style={{ gap: 6 }}>
          <Text variant="small" color={colors.ink700}>
            {t("common.confirm.typeToConfirm", { word })}
          </Text>
          <Field value={typed} onChangeText={setTyped} autoCapitalize="characters" autoCorrect={false} accessibilityLabel={t("common.confirm.typeToConfirm", { word })} />
        </View>
        {error ? (
          <Text accessibilityRole="alert" variant="small" weight="medium" color={colors.terra600}>
            {error}
          </Text>
        ) : null}
        <Button tone="danger" size="lg" label={busy ? t("product.account.deleting") : t("product.account.confirmDelete")} onPress={deleteAccount} disabled={!armed} busy={busy} />
        <Button tone="soft" label={t("common.cancel")} onPress={() => router.back()} disabled={busy} />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  warning: { flexDirection: "row", alignItems: "center", gap: 10, padding: 16, borderRadius: radius.card, backgroundColor: colors.terra100 },
});
