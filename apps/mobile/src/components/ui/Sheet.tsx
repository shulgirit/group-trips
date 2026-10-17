import { colors } from "@together/shared/tokens";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/components/ui/Text";
import { useT } from "@/lib/i18n";

/** A native page sheet with a title and a close action (the web's BottomSheet). */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const t = useT();
  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView edges={["bottom"]} style={styles.sheet}>
        <View style={styles.head}>
          <Text variant="headline" weight="semibold" numberOfLines={2} style={{ flex: 1 }}>
            {title}
          </Text>
          <Pressable accessibilityRole="button" onPress={onClose} hitSlop={12}>
            <Text weight="medium" color={colors.route700}>
              {t("common.close")}
            </Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.chart50 },
  head: { flexDirection: "row", alignItems: "center", gap: 12, padding: 20 },
  body: { paddingHorizontal: 20, paddingBottom: 32, gap: 16 },
});
