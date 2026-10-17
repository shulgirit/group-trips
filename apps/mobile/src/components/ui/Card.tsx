import { colors, radius } from "@together/shared/tokens";
import { StyleSheet, View, type ViewProps } from "react-native";

/** A raised paper surface on the chart-paper ground. */
export function Card({ style, ...props }: ViewProps) {
  return <View {...props} style={[styles.card, style]} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.paper,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.chart200,
    shadowColor: colors.ink900,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1,
  },
});
