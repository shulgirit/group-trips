import "server-only";
import { createHash } from "node:crypto";
import webpush from "web-push";
import { adminDb, adminMessaging } from "@/lib/firebase/admin";
import { isLocale, type Locale } from "@/i18n/config";

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  /** Waze/Maps deep link — rendered as a "נווט" notification action */
  navUrl?: string;
}

interface StoredSubscription {
  /** "fcm" = native app token (iOS/Android); absent = web push */
  kind?: "web" | "fcm";
  endpoint: string;
  keys: { p256dh: string; auth: string };
  token?: string;
  uid?: string;
  /** UI language of the device that subscribed */
  locale?: string;
}

/** A fixed payload, or one built per subscriber language. */
export type PushContent = PushPayload | ((locale: Locale) => PushPayload);

/** Legacy subscriptions predate languages — they're all Hebrew speakers. */
function subscriberLocale(sub: StoredSubscription): Locale {
  return isLocale(sub.locale) ? sub.locale : "he";
}

/** Native app notification via FCM (APNs on iOS). */
async function sendFcm(token: string, payload: PushPayload): Promise<"ok" | "gone" | "error"> {
  try {
    await adminMessaging().send({
      token,
      notification: { title: payload.title, body: payload.body },
      data: {
        url: payload.url ?? "/",
        ...(payload.navUrl ? { navUrl: payload.navUrl } : {}),
        ...(payload.tag ? { tag: payload.tag } : {}),
      },
      android: {
        priority: "high",
        notification: { ...(payload.tag ? { tag: payload.tag } : {}), sound: "default" },
      },
      apns: {
        payload: { aps: { sound: "default", ...(payload.tag ? { "thread-id": payload.tag } : {}) } },
      },
    });
    return "ok";
  } catch (error) {
    const code = (error as { code?: string })?.code ?? "";
    if (
      code === "messaging/registration-token-not-registered" ||
      code === "messaging/invalid-registration-token"
    ) {
      return "gone";
    }
    console.error("[push] fcm send failed", code);
    return "error";
  }
}

function configured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
  );
}

function setup() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:omer@wiply.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
}

export function subscriptionDocId(endpoint: string): string {
  return createHash("sha256").update(endpoint).digest("hex").slice(0, 32);
}

export function subscriptionsRef(tripPath: string) {
  return adminDb().collection(`${tripPath}/pushSubscriptions`);
}

/**
 * Sends a notification to every subscribed device. Dead subscriptions
 * (uninstalled PWA, expired endpoints) are cleaned up on the way.
 * Best-effort by design — never throws.
 */
export async function sendPushToAll(
  tripPath: string,
  content: PushContent,
  options?: { excludeUid?: string }
): Promise<{ sent: number; removed: number }> {
  const webReady = configured();
  if (webReady) setup();

  const snapshot = await subscriptionsRef(tripPath).get();
  let sent = 0;
  let removed = 0;
  const render = (locale: Locale) =>
    typeof content === "function" ? content(locale) : content;

  await Promise.all(
    snapshot.docs.map(async (doc) => {
      const sub = doc.data() as StoredSubscription;
      if (
        options?.excludeUid &&
        sub.uid &&
        sub.uid === options.excludeUid &&
        sub.uid !== "trip-member"
      ) {
        return;
      }
      const payload = render(subscriberLocale(sub));
      if (sub.kind === "fcm" && sub.token) {
        const result = await sendFcm(sub.token, payload);
        if (result === "ok") sent++;
        if (result === "gone") {
          await doc.ref.delete().catch(() => undefined);
          removed++;
        }
        return;
      }
      if (!webReady) return;
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          JSON.stringify(payload)
        );
        sent++;
      } catch (error) {
        const status = (error as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          await doc.ref.delete().catch(() => undefined);
          removed++;
        } else {
          console.error("[push] send failed", status);
        }
      }
    })
  );

  return { sent, removed };
}

/** Welcome ping to one native device. */
export async function sendFcmTo(token: string, payload: PushPayload): Promise<boolean> {
  return (await sendFcm(token, payload)) === "ok";
}

/** Sends to a single subscription (used by the test button). */
export async function sendPushTo(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: PushPayload
): Promise<boolean> {
  if (!configured()) return false;
  setup();
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return true;
  } catch (error) {
    console.error("[push] test send failed", error);
    return false;
  }
}
