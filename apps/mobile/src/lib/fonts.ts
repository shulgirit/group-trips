import { FrankRuhlLibre_500Medium } from "@expo-google-fonts/frank-ruhl-libre";
import { IBMPlexSans_400Regular, IBMPlexSans_500Medium, IBMPlexSans_600SemiBold } from "@expo-google-fonts/ibm-plex-sans";
import { Jost_400Regular } from "@expo-google-fonts/jost";
import { OpenSans_400Regular, OpenSans_500Medium, OpenSans_600SemiBold, OpenSans_700Bold } from "@expo-google-fonts/open-sans";
import type { Locale } from "@together/i18n/config";

export const FONT_ASSETS = {
  FrankRuhlLibre_500Medium,
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  Jost_400Regular,
  OpenSans_400Regular,
  OpenSans_500Medium,
  OpenSans_600SemiBold,
  OpenSans_700Bold,
};

export type Weight = "regular" | "medium" | "semibold";

/**
 * Hebrew uses Open Sans everywhere (headings included); other languages use
 * IBM Plex Sans with the Frank Ruhl Libre serif for display; Arabic falls
 * back to the system font, which shapes Arabic correctly.
 */
export function fontFor(locale: Locale, weight: Weight, display = false): string | undefined {
  if (locale === "ar") return undefined;
  if (locale === "he") {
    return display ? "OpenSans_600SemiBold" : { regular: "OpenSans_400Regular", medium: "OpenSans_500Medium", semibold: "OpenSans_600SemiBold" }[weight];
  }
  if (display) return "FrankRuhlLibre_500Medium";
  return { regular: "IBMPlexSans_400Regular", medium: "IBMPlexSans_500Medium", semibold: "IBMPlexSans_600SemiBold" }[weight];
}
