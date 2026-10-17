"use client";

import { api } from "@together/backend/api";
import type { Id } from "@together/backend/dataModel";
import { activeLocale } from "@together/i18n/active";
import { activeTrip } from "@/lib/active-trip";
import { convex } from "@/lib/convex";

/**
 * Browser push (web app). Group notifications are sent by the server once
 * per action; the native app uses Expo push instead.
 */

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function isIosSafariNotInstalled(): boolean {
  if (typeof window === "undefined") return false;
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari legacy flag
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  return isIos && !standalone;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch {
    return null;
  }
}

export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  return registration ? registration.pushManager.getSubscription() : null;
}

/** Whether this device currently receives the trip's notifications. */
export async function pushEnabled(): Promise<boolean> {
  const subscription = await getCurrentSubscription();
  return Boolean(subscription) && Notification.permission === "granted";
}

const tripId = () => activeTrip().id as Id<"trips">;

export async function subscribeToPush(): Promise<"subscribed" | "denied" | "failed"> {
  if (!pushSupported()) return "failed";
  const registration = await registerServiceWorker();
  if (!registration) return "failed";
  await navigator.serviceWorker.ready;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";
  try {
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!) as unknown as BufferSource,
      }));
    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return "failed";
    await convex.mutation(api.push.subscribeWeb, {
      tripId: tripId(),
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      locale: activeLocale(),
    });
    return "subscribed";
  } catch {
    return "failed";
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  const subscription = await getCurrentSubscription();
  if (!subscription) return;
  await convex.mutation(api.push.unsubscribeWeb, { tripId: tripId(), endpoint: subscription.endpoint }).catch(() => undefined);
  await subscription.unsubscribe().catch(() => undefined);
}
