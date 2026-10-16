"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { nativePlugin } from "@/lib/native";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Listener = { remove: () => void };

/**
 * Store-app glue (no-op on the web): routes universal links (invite
 * links opened from WhatsApp) and notification taps into the web app.
 */
export function NativeBridge() {
  const router = useRouter();

  useEffect(() => {
    const app = nativePlugin<any>("App");
    const messaging = nativePlugin<any>("FirebaseMessaging");
    const handles: Promise<Listener>[] = [];

    const go = (target: string | undefined) => {
      if (!target) return;
      try {
        const url = new URL(target, window.location.origin);
        if (url.origin === window.location.origin) {
          router.push(`${url.pathname}${url.search}`);
        } else {
          window.open(url.toString(), "_blank");
        }
      } catch {
        // malformed — ignore
      }
    };

    if (app?.addListener) {
      handles.push(app.addListener("appUrlOpen", (event: { url: string }) => go(event.url)));
    }
    if (messaging?.addListener) {
      handles.push(
        messaging.addListener(
          "notificationActionPerformed",
          (event: { actionId?: string; notification?: { data?: Record<string, string> } }) => {
            const data = event.notification?.data ?? {};
            go(event.actionId === "navigate" && data.navUrl ? data.navUrl : data.url);
          }
        )
      );
    }
    return () => {
      handles.forEach((handle) => handle.then((h) => h.remove()).catch(() => undefined));
    };
  }, [router]);

  return null;
}
