import { colors, space } from "@together/shared/tokens";
import { KeyboardAvoidingView, RefreshControl, ScrollView, StyleSheet, View, type ViewStyle } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

/**
 * A scrolling page on the chart-paper ground with safe areas and keyboard
 * avoidance. `dark` = the Atlas night ground (onboarding, invites).
 */
export function Screen({
  children,
  dark = false,
  scroll = true,
  edges = ["top"],
  onRefresh,
  refreshing = false,
  contentStyle,
}: {
  children: React.ReactNode;
  dark?: boolean;
  scroll?: boolean;
  edges?: Edge[];
  onRefresh?: () => void;
  refreshing?: boolean;
  contentStyle?: ViewStyle;
}) {
  const background = dark ? colors.night950 : colors.chart50;
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.content, contentStyle]}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, { flex: 1 }, contentStyle]}>{children}</View>
  );
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        {body}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.lg + 4, paddingBottom: 120, paddingTop: space.lg, gap: space.lg },
});
