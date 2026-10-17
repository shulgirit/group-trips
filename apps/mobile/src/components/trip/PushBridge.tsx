import { useConvexAuth } from "convex/react";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { useLocale, useT } from "@/lib/i18n";
import { openNotification, registerDevice } from "@/lib/push";

/** Keeps this device's push token current while signed in, and opens tapped notifications. */
export function PushBridge() {
  const t = useT();
  const { locale } = useLocale();
  const { isAuthenticated } = useConvexAuth();

  useEffect(() => {
    if (!isAuthenticated) return;
    // Only re-registers when permission was already given (asking happens in the nudge)
    registerDevice(locale, t("trip.home.navigate")).catch(() => undefined);
  }, [isAuthenticated, locale, t]);

  useEffect(() => {
    // Cold start from a notification, then every tap while running
    Notifications.getLastNotificationResponseAsync()
      .then((response) => response && openNotification(response))
      .catch(() => undefined);
    const subscription = Notifications.addNotificationResponseReceivedListener(openNotification);
    return () => subscription.remove();
  }, []);

  return null;
}
