import { colors } from "@together/shared/tokens";
import { Image } from "expo-image";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { Text } from "@/components/ui/Text";

type Props = {
  image?: string | null;
  name?: string | null;
  size: number;
  background?: string;
  textColor?: string;
  style?: ViewStyle;
};

/** A person's photo, or their first letter on a colour when they have none. */
export function Avatar({ image, name, size, background = colors.chart100, textColor = colors.ink700, style }: Props) {
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", backgroundColor: background, alignItems: "center", justifyContent: "center" }, style]}>
      {image ? (
        <Image source={image} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <Text variant={size >= 40 ? "headline" : size >= 30 ? "small" : "caption"} weight="medium" color={textColor}>
          {(name || "?").slice(0, 1)}
        </Text>
      )}
    </View>
  );
}
