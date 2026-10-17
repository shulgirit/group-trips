import { colors } from "@together/shared/tokens";
import { View } from "react-native";
import { Text } from "./Text";

/** A form section: label above its control. */
export function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text variant="small" weight="medium" color={colors.ink700}>
        {label}
      </Text>
      {children}
    </View>
  );
}
