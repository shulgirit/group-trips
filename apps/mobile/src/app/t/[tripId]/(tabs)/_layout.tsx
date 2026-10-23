import { colors } from "@together/shared/tokens";
import { getLocales } from "expo-localization";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { I18nManager, Platform } from "react-native";
import { useT } from "@/lib/i18n";
import { useTrip } from "@/lib/trip";

/** Now · Guide · Schedule · Places (list/map) · More — system tab bar on both platforms. */
export default function TripTabs() {
  const t = useT();
  const { config } = useTrip();
  // The system tab bar follows the phone's language direction, not the app's: on a Hebrew phone with the app in
  // English it would show More on the left. Reverse the order when the two disagree so Now is always first on the
  // reading side of the app's own language.
  const deviceRtl = getLocales()[0]?.textDirection === "rtl";
  const reverse = Platform.OS === "ios" && deviceRtl !== I18nManager.isRTL; // Android follows I18nManager
  const tabs: Record<string, React.ReactElement> = {
    index: (
      <NativeTabs.Trigger key="index" name="index" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Icon sf={{ default: "sun.horizon", selected: "sun.horizon.fill" }} md="today" />
        <NativeTabs.Trigger.Label>{t("trip.nav.home")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    ),
    guide: (
      <NativeTabs.Trigger key="guide" name="guide">
        <NativeTabs.Trigger.Icon sf="sparkles" md="auto_awesome" />
        <NativeTabs.Trigger.Label>{config.ai.navLabel}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    ),
    schedule: (
      <NativeTabs.Trigger key="schedule" name="schedule">
        <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
        <NativeTabs.Trigger.Label>{t("trip.nav.schedule")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    ),
    places: (
      <NativeTabs.Trigger key="places" name="places">
        <NativeTabs.Trigger.Icon sf={{ default: "mappin.and.ellipse", selected: "mappin.and.ellipse" }} md="location_on" />
        <NativeTabs.Trigger.Label>{t("trip.nav.places")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    ),
    more: (
      <NativeTabs.Trigger key="more" name="more">
        <NativeTabs.Trigger.Icon sf="ellipsis.circle" md="more_horiz" />
        <NativeTabs.Trigger.Label>{t("trip.nav.more")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    ),
  };
  const order = ["index", "guide", "schedule", "places", "more"];
  const ordered = (reverse ? [...order].reverse() : order).map((name) => tabs[name]);
  return (
    <NativeTabs tintColor={colors.ink900} iconColor={{ default: colors.ink400, selected: colors.ink900 }} backgroundColor={colors.chart50}>
      {ordered}
    </NativeTabs>
  );
}
