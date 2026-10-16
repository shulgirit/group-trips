"use client";

import { useEffect, useState } from "react";
import { BellRing, BellOff, Download } from "lucide-react";
import { useFirebase } from "@/components/providers/FirebaseProvider";
import { STROKE } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { SURFACE } from "@/components/settings/SettingsGroup";
import { useT } from "@/i18n";
import {
  pushEnabled,
  isIosSafariNotInstalled,
  pushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push-client";

type Status = "loading" | "unsupported" | "install_first" | "off" | "on";

export function NotificationsSection() {
  const { user } = useFirebase();
  const t = useT();
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    (async () => {
      if (!pushSupported()) {
        setStatus(isIosSafariNotInstalled() ? "install_first" : "unsupported");
        return;
      }
      if (isIosSafariNotInstalled()) {
        setStatus("install_first");
        return;
      }
      setStatus((await pushEnabled()) ? "on" : "off");
    })();
  }, []);

  async function enable() {
    setBusy(true);
    setMessage("");
    const result = await subscribeToPush({
      uid: user?.uid,
      userName: user?.displayName ?? undefined,
    });
    if (result === "subscribed") {
      setStatus("on");
      setMessage(t("settings.notifications.welcomeSent"));
    } else if (result === "denied") {
      setMessage(t("settings.notifications.denied"));
    } else {
      setMessage(t("settings.notifications.failed"));
    }
    setBusy(false);
  }

  async function disable() {
    setBusy(true);
    setMessage("");
    await unsubscribeFromPush();
    setStatus("off");
    setBusy(false);
  }

  return (
    <div className={`${SURFACE} p-4`}>
      {status === "loading" ? (
        <div aria-busy className="space-y-2">
          <p className="sr-only">{t("settings.notifications.checking")}</p>
          <Skeleton className="h-4 w-3/4 rounded-full" />
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      ) : status === "unsupported" ? (
        <p className="flex gap-3 text-sm leading-relaxed text-ink-500">
          <BellOff size={18} strokeWidth={STROKE} aria-hidden className="mt-0.5 shrink-0 text-ink-400" />
          <span>{t("settings.notifications.unsupported")}</span>
        </p>
      ) : status === "install_first" ? (
        <p className="flex gap-3 text-sm leading-relaxed text-ink-700">
          <Download size={18} strokeWidth={STROKE} aria-hidden className="mt-0.5 shrink-0 text-ink-400" />
          <span>{t("settings.notifications.installFirst")}</span>
        </p>
      ) : (
        <>
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                status === "on" ? "bg-route-100 text-route-700" : "border border-cream-200 text-ink-500"
              }`}
            >
              {status === "on" ? (
                <BellRing size={18} strokeWidth={STROKE} />
              ) : (
                <BellOff size={18} strokeWidth={STROKE} />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-medium text-ink-900">
                {status === "on"
                  ? t("settings.notifications.statusOn")
                  : t("settings.notifications.statusOff")}
              </p>
              <p className="mt-0.5 text-sm leading-relaxed text-ink-500">
                {t("settings.notifications.description")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={status === "on" ? disable : enable}
            disabled={busy}
            className={`mt-3 min-h-11 w-full text-sm ${
              status === "on" ? "btn-soft" : "btn-primary"
            }`}
          >
            {status === "on" ? (
              <>
                <BellOff size={18} strokeWidth={STROKE} aria-hidden />
                {busy
                  ? t("settings.notifications.wait")
                  : t("settings.notifications.disable")}
              </>
            ) : (
              <>
                <BellRing size={18} strokeWidth={STROKE} aria-hidden />
                {busy
                  ? t("settings.notifications.enabling")
                  : t("settings.notifications.enable")}
              </>
            )}
          </button>
        </>
      )}
      {message && (
        <p role="status" className="mt-2 text-sm text-ink-700">
          {message}
        </p>
      )}
    </div>
  );
}
