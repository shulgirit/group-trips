import { colors } from "@together/shared/tokens";
import { View } from "react-native";
import { Text } from "@/components/ui/Text";

export function StepHeader({ title, text }: { title: string; text: string }) {
  return (
    <View style={{ gap: 8 }}>
      <Text variant="display">{title}</Text>
      <Text variant="body" color={colors.ink500}>
        {text}
      </Text>
    </View>
  );
}
