import { colors, type as scale } from "@together/shared/tokens";
import { Text as RNText, type TextProps, type TextStyle } from "react-native";
import { fontFor, type Weight } from "@/lib/fonts";
import { useLocale } from "@/lib/i18n";

type Variant = "displayLg" | "display" | "title" | "headline" | "body" | "small" | "caption";

const LINE: Record<Variant, number> = { displayLg: 1.08, display: 1.12, title: 1.2, headline: 1.3, body: 1.5, small: 1.45, caption: 1.4 };
const DISPLAY: Variant[] = ["displayLg", "display", "title"];

export function Text({
  variant = "body",
  weight = "regular",
  color = colors.ink900,
  align,
  style,
  ...props
}: TextProps & { variant?: Variant; weight?: Weight; color?: string; align?: TextStyle["textAlign"] }) {
  const { locale } = useLocale();
  const size = scale[variant];
  const display = DISPLAY.includes(variant);
  const family = fontFor(locale, weight, display);
  return (
    <RNText
      {...props}
      style={[
        {
          fontSize: size,
          lineHeight: Math.round(size * LINE[variant]),
          color,
          fontFamily: family,
          // System font (Arabic) needs an explicit weight
          fontWeight: family ? undefined : weight === "semibold" ? "600" : weight === "medium" ? "500" : "400",
          // Start-aligned in both directions unless asked otherwise
          textAlign: align ?? "left",
          writingDirection: locale === "he" || locale === "ar" ? "rtl" : "ltr",
        },
        style,
      ]}
    />
  );
}
