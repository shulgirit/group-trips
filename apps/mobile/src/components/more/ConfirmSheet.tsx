import { colors, radius } from "@together/shared/tokens";
import { Dot } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Text } from "@/components/ui/Text";
import { useT } from "@/lib/i18n";

/**
 * A destructive confirmation: what will be lost, and (when `confirmWord` is
 * set) the word typed out before the button arms. For leave/delete trip and
 * delete account.
 */
export function ConfirmSheet({
  open,
  title,
  description,
  items,
  confirmWord,
  confirmLabel,
  busyLabel,
  error,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  items?: string[];
  confirmWord?: string;
  confirmLabel: string;
  busyLabel?: string;
  error?: string;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}) {
  const t = useT();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  // Closing resets the sheet for next time
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) {
      setTyped("");
      setBusy(false);
    }
  }
  const armed = !confirmWord || typed.trim().toUpperCase() === confirmWord.toUpperCase();

  async function confirm() {
    if (!armed || busy) return;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={busy ? undefined : onClose} accessibilityLabel={t("common.close")} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.wrap} pointerEvents="box-none">
        <SafeAreaView edges={["bottom"]} style={styles.sheet}>
          <ScrollView contentContainerStyle={{ gap: 14, padding: 22 }} keyboardShouldPersistTaps="handled">
            <Text variant="title">{title}</Text>
            {description ? (
              <Text variant="small" color={colors.ink500}>
                {description}
              </Text>
            ) : null}
            {items?.length ? (
              <View style={{ gap: 6 }}>
                {items.map((item) => (
                  <View key={item} style={{ flexDirection: "row", gap: 4 }}>
                    <Icon icon={Dot} size={18} color={colors.terra600} />
                    <Text variant="small" color={colors.ink700} style={{ flex: 1 }}>
                      {item}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
            <Text variant="small" weight="medium" color={colors.terra600}>
              {t("common.confirm.irreversible")}
            </Text>
            {confirmWord ? (
              <View style={{ gap: 6 }}>
                <Text variant="small" color={colors.ink700}>
                  {t("common.confirm.typeToConfirm", { word: confirmWord })}
                </Text>
                <Field value={typed} onChangeText={setTyped} autoCapitalize="characters" autoCorrect={false} accessibilityLabel={t("common.confirm.typeToConfirm", { word: confirmWord })} />
              </View>
            ) : null}
            {error ? (
              <Text accessibilityRole="alert" variant="small" weight="medium" color={colors.terra600}>
                {error}
              </Text>
            ) : null}
            <Button tone="danger" size="lg" label={busy ? (busyLabel ?? t("common.confirm.working")) : confirmLabel} onPress={confirm} disabled={!armed} busy={busy} />
            <Button tone="soft" label={t("common.cancel")} onPress={onClose} disabled={busy} />
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: "rgba(15,27,45,0.55)" },
  wrap: { flex: 1, justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.chart50, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, maxHeight: "90%" },
});
