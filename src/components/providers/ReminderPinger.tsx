"use client";

import { useEffect } from "react";
import { registerServiceWorker } from "@/lib/push-client";

const PING_INTERVAL_MS = 5 * 60_000;

/**
 * Keeps event reminders flowing: any open client pings the server every
 * few minutes, and the server pushes "leaving soon" notifications for
 * events starting within the next hour. Also keeps the service worker
 * registration fresh for devices that already subscribed.
 */
export function ReminderPinger() {
  useEffect(() => {
    registerServiceWorker();

    const ping = () => {
      if (document.visibilityState !== "visible") return;
      fetch("/api/push/check-reminders", { method: "POST" }).catch(
        () => undefined
      );
    };

    ping();
    const interval = setInterval(ping, PING_INTERVAL_MS);
    document.addEventListener("visibilitychange", ping);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", ping);
    };
  }, []);

  return null;
}
