"use client";

import { useEffect, useState } from "react";
import { BellRing, BellOff, Download } from "lucide-react";
import { useFirebase } from "@/components/providers/FirebaseProvider";
import { STROKE } from "@/components/ui/Icon";
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
    <section>
      <h2 className="section-title mb-3 font-normal">
        {t("settings.notifications.title")}
      </h2>
      <div className="card px-4 py-4">
        {status === "loading" ? (
          <p className="text-sm text-ink-500">{t("settings.notifications.checking")}</p>
        ) : status === "unsupported" ? (
          <p className="text-sm leading-relaxed text-ink-500">
            {t("settings.notifications.unsupported")}
          </p>
        ) : status === "install_first" ? (
          <p className="flex gap-3 text-sm leading-relaxed text-ink-700">
            <Download size={18} strokeWidth={STROKE} aria-hidden className="mt-0.5 shrink-0 text-ink-300" />
            <span>{t("settings.notifications.installFirst")}</span>
          </p>
        ) : (
          <>
            <p className="text-sm leading-relaxed text-ink-500">
              {t("settings.notifications.description")}
            </p>
            <button
              type="button"
              onClick={status === "on" ? disable : enable}
              disabled={busy}
              className={`mt-3 w-full py-3 ${
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
    </section>
  );
}
