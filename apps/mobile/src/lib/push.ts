import { api } from "@together/backend/api";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { type Href, router } from "expo-router";
import { Linking, Platform } from "react-native";
import { convex } from "./convex";

/**
 * Native notifications (Expo push). Permission is asked at a moment that
 * makes sense (the Now screen's nudge), never at launch; once granted, the
 * device token is (re)registered on every launch while signed in.
 */

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

let currentToken: string | null = null;

const projectId = (): string | undefined =>
  (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? Constants.easConfig?.projectId;

export async function notificationsAllowed(): Promise<"granted" | "denied" | "undetermined"> {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

/** Button labels follow the app language, so categories are set per language. */
async function setup(navigateLabel: string) {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", { name: "Together", importance: Notifications.AndroidImportance.HIGH });
  }
  await Notifications.setNotificationCategoryAsync("navigate", [{ identifier: "navigate", buttonTitle: navigateLabel, options: { opensAppToForeground: false } }]);
}

/** Gets this device's push token and stores it for the signed-in user. Quietly no-ops where push can't work. */
export async function registerDevice(locale: string, navigateLabel: string, ask = false): Promise<"granted" | "denied" | "unavailable"> {
  if (!Device.isDevice || !projectId()) return "unavailable";
  let status = await notificationsAllowed();
  if (status === "undetermined" && ask) status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") return "denied";
  await setup(navigateLabel);
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: projectId() });
  currentToken = token;
  await convex.mutation(api.push.registerApp, { token, platform: Platform.OS === "ios" ? "ios" : "android", locale });
  return "granted";
}

/** Before signing out: stop this device receiving the account's notifications. */
export async function unregisterDevice(): Promise<void> {
  if (!currentToken) return;
  await convex.mutation(api.push.unregisterApp, { token: currentToken }).catch(() => undefined);
  currentToken = null;
}

/** Server URLs are web paths; a few screens are named differently in the app. */
export function appPath(url: string): string {
  return url.replace(/^(\/t\/[^/?#]+)\/calendar(?=$|[/?#])/, "$1/schedule");
}

/** A tapped notification opens its screen; the "navigate" action opens Waze. */
export function openNotification(response: Notifications.NotificationResponse) {
  const data = response.notification.request.content.data as { url?: string; navUrl?: string } | undefined;
  if (response.actionIdentifier === "navigate" && data?.navUrl) {
    Linking.openURL(data.navUrl).catch(() => undefined);
    return;
  }
  if (data?.url?.startsWith("/")) router.push(appPath(data.url) as Href);
}
