"use client";

import { useEffect, useState } from "react";
import { BellRing, Check } from "lucide-react";
import { useFirebase } from "@/components/providers/FirebaseProvider";
import { STROKE } from "@/components/ui/Icon";
import { useT } from "@/i18n";
import { isNative } from "@/lib/native";
import { isIosSafariNotInstalled, pushEnabled, pushSupported, subscribeToPush } from "@/lib/push-client";

const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Asks for notifications at a moment that makes sense — inside a trip, with
 * a reason — instead of on launch. "Not now" snoozes it for a week; it
 * disappears once notifications are on.
 */
export function NotifyNudge({ tripId }: { tripId: string }) {
  const t = useT();
  const { user } = useFirebase();
  const key = `together-notify-nudge-${tripId}`;
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snoozed = Number(localStorage.getItem(key) ?? 0);
        if (Date.now() - snoozed < SNOOZE_MS) return;
      } catch {
        return;
      }
      const supported = isNative() || (pushSupported() && !isIosSafariNotInstalled());
      if (!supported) return;
      const on = await pushEnabled().catch(() => true);
      if (!cancelled && !on) setVisible(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [key]);

  if (!visible) return null;

  function snooze() {
    try {
      localStorage.setItem(key, String(Date.now()));
    } catch {
      // ignore
    }
    setVisible(false);
  }

  async function enable() {
    setBusy(true);
    setMessage("");
    const result = await subscribeToPush({ uid: user?.uid, userName: user?.displayName ?? undefined });
    setBusy(false);
    if (result === "subscribed") {
      setDone(true);
      setTimeout(() => setVisible(false), 2200);
    } else if (result === "denied") {
      setMessage(t("trip.permissions.notify.denied"));
    }
  }

  return (
    <section className="flex items-start gap-3 rounded-2xl border border-brass-300 bg-brass-100 px-4 py-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-brass-600">
        {done ? <Check size={18} strokeWidth={2} aria-hidden /> : <BellRing size={18} strokeWidth={STROKE} aria-hidden />}
      </span>
      <div className="min-w-0 flex-1">
        {done ? (
          <p className="pt-2 font-medium text-ink-900">{t("trip.permissions.notify.done")}</p>
        ) : (
          <>
            <p className="font-medium text-ink-900">{t("trip.permissions.notify.title")}</p>
            <p className="mt-0.5 text-sm leading-relaxed text-ink-700">{t("trip.permissions.notify.text")}</p>
            {message && <p className="mt-2 text-sm text-terra-600">{message}</p>}
            <div className="mt-3 flex gap-2">
              <button type="button" disabled={busy} onClick={enable} className="btn-primary px-4 py-2.5 text-sm">
                {t("trip.permissions.notify.enable")}
              </button>
              <button type="button" onClick={snooze} className="btn-soft px-4 py-2.5 text-sm">
                {t("trip.permissions.notify.later")}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
