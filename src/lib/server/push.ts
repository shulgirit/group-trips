import "server-only";
import { createHash } from "node:crypto";
import webpush from "web-push";
import { adminDb } from "@/lib/firebase/admin";
import { TRIP_PATH } from "@/lib/trip";

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  /** Waze/Maps deep link — rendered as a "נווט" notification action */
  navUrl?: string;
}

interface StoredSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  uid?: string;
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

function subscriptionsRef() {
  return adminDb().collection(`${TRIP_PATH}/pushSubscriptions`);
}

/**
 * Sends a notification to every subscribed device. Dead subscriptions
 * (uninstalled PWA, expired endpoints) are cleaned up on the way.
 * Best-effort by design — never throws.
 */
export async function sendPushToAll(
  payload: PushPayload,
  options?: { excludeUid?: string }
): Promise<{ sent: number; removed: number }> {
  if (!configured()) return { sent: 0, removed: 0 };
  setup();

  const snapshot = await subscriptionsRef().get();
  let sent = 0;
  let removed = 0;
  const body = JSON.stringify(payload);

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
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          body
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
