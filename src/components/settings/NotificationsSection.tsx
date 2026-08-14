"use client";

import { useEffect, useState } from "react";
import { BellRing, BellOff } from "lucide-react";
import { useFirebase } from "@/components/providers/FirebaseProvider";
import {
  getCurrentSubscription,
  isIosSafariNotInstalled,
  pushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push-client";

type Status = "loading" | "unsupported" | "install_first" | "off" | "on";

export function NotificationsSection() {
  const { user } = useFirebase();
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
      const subscription = await getCurrentSubscription();
      setStatus(
        subscription && Notification.permission === "granted" ? "on" : "off"
      );
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
      setMessage("✓ נשלחה אליכם התראת ברוכים הבאים");
    } else if (result === "denied") {
      setMessage(
        "ההרשאה נדחתה — אפשר לאשר התראות מחדש דרך הגדרות הדפדפן/המכשיר"
      );
    } else {
      setMessage("לא הצלחנו להפעיל התראות במכשיר הזה");
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
      <h2 className="section-title mb-3 text-lg">🔔 התראות</h2>
      <div className="card px-4 py-4">
        {status === "loading" ? (
          <p className="text-sm text-ink-500">בודק…</p>
        ) : status === "unsupported" ? (
          <p className="text-sm leading-relaxed text-ink-500">
            הדפדפן הזה לא תומך בהתראות דחיפה — נסו מהטלפון
          </p>
        ) : status === "install_first" ? (
          <p className="text-sm leading-relaxed text-ink-700">
            📲 באייפון, התראות עובדות רק מהאפליקציה המותקנת: שיתוף ← ״הוסף
            למסך הבית״, ואז הפעילו כאן את ההתראות מתוך האפליקציה
          </p>
        ) : (
          <>
            <p className="text-sm leading-relaxed text-ink-500">
              נעדכן על סקרים חדשים, אירועים שנוספים ללוח, ותזכורת כ-45 דקות
              לפני כל פעילות
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
                  <BellOff size={18} />
                  {busy ? "רגע…" : "כיבוי התראות במכשיר הזה"}
                </>
              ) : (
                <>
                  <BellRing size={18} />
                  {busy ? "מפעיל…" : "הפעלת התראות במכשיר הזה"}
                </>
              )}
            </button>
          </>
        )}
        {message && (
          <p className="mt-2 text-sm font-medium text-ink-700">{message}</p>
        )}
      </div>
    </section>
  );
}
