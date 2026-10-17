import { colors } from "@together/shared/tokens";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useT } from "@/lib/i18n";
import { useTrip } from "@/lib/trip";

/** Now · Guide · Schedule · Places (list/map) · More — system tab bar on both platforms. */
export default function TripTabs() {
  const t = useT();
  const { config } = useTrip();
  return (
    <NativeTabs tintColor={colors.ink900} iconColor={{ default: colors.ink400, selected: colors.ink900 }} backgroundColor={colors.chart50} minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="index" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Icon sf={{ default: "sun.horizon", selected: "sun.horizon.fill" }} md="today" />
        <NativeTabs.Trigger.Label>{t("trip.nav.home")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="guide">
        <NativeTabs.Trigger.Icon sf="sparkles" md="auto_awesome" />
        <NativeTabs.Trigger.Label>{config.ai.navLabel}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="schedule">
        <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
        <NativeTabs.Trigger.Label>{t("trip.nav.schedule")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="places">
        <NativeTabs.Trigger.Icon sf={{ default: "mappin.and.ellipse", selected: "mappin.and.ellipse" }} md="location_on" />
        <NativeTabs.Trigger.Label>{t("trip.nav.places")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="more">
        <NativeTabs.Trigger.Icon sf="ellipsis.circle" md="more_horiz" />
        <NativeTabs.Trigger.Label>{t("trip.nav.more")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
