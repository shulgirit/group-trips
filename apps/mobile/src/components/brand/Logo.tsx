import { colors } from "@together/shared/tokens";
import { Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

/** The mark: a T drawn as two routes that meet at a brass node and continue as one. */
export function LogoMark({ size = 32, color = colors.ink900 }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d="M6 12C14 12 20 13.5 24 19M42 12C34 12 28 13.5 24 19V42" stroke={color} strokeWidth={2.6} strokeLinecap="round" />
      <Circle cx={24} cy={19} r={3.3} fill={colors.brass500} />
    </Svg>
  );
}

/** Mark + TOGETHER wordmark (always left-to-right). */
export function Logo({ color = colors.ink900, size = 28 }: { color?: string; size?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, direction: "ltr" }} accessibilityLabel="Together">
      <LogoMark size={size} color={color} />
      <Text style={{ fontFamily: "Jost_400Regular", fontSize: 15, letterSpacing: 3.6, color }}>TOGETHER</Text>
    </View>
  );
}
