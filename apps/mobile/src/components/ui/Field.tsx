import { colors, radius } from "@together/shared/tokens";
import { forwardRef } from "react";
import { StyleSheet, TextInput, type TextInputProps } from "react-native";
import { fontFor } from "@/lib/fonts";
import { useLocale } from "@/lib/i18n";

/** Text input in the house style; user text follows its own direction. */
export const Field = forwardRef<TextInput, TextInputProps & { large?: boolean }>(function Field({ style, large, ...props }, ref) {
  const { locale } = useLocale();
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={colors.ink400}
      {...props}
      style={[styles.field, { fontFamily: fontFor(locale, "regular"), fontSize: large ? 19 : 16 }, style]}
    />
  );
});

const styles = StyleSheet.create({
  field: {
    minHeight: 50,
    borderRadius: radius.field,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.chart200,
    backgroundColor: colors.paper,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: colors.ink900,
    textAlign: "auto",
  },
});
