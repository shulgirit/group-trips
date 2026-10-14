"use client";

import { useEffect, useState } from "react";
import { useFirebase } from "@/components/providers/FirebaseProvider";
import {
  apiFetch,
  appleSignInAvailable,
  auth,
  linkGuestAccount,
} from "@/lib/firebase/client";

/**
 * Guests (joined without an account) can attach Google/Apple later — same
 * identity, so nothing is lost, and the trip opens on any new phone.
 */
export function SaveAccountCard() {
  const { user } = useFirebase();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const [showApple, setShowApple] = useState(false);
  useEffect(() => setShowApple(appleSignInAvailable()), []);

  if (!user?.isAnonymous && !done) return null;

  async function link(kind: "google" | "apple") {
    setBusy(true);
    setMessage("");
    try {
      await linkGuestAccount(kind);
      await auth().currentUser?.getIdToken(true);
      await apiFetch("/api/account", { method: "POST" }).catch(() => undefined);
      setDone(true);
    } catch (error) {
      const code = (error as { code?: string }).code ?? "";
      setMessage(
        code === "auth/credential-already-in-use" || code === "auth/email-already-in-use"
          ? "החשבון הזה כבר קיים אצלנו. התנתקו, התחברו איתו ופתחו שוב את קישור ההזמנה."
          : code === "auth/popup-closed-by-user"
            ? ""
            : "החיבור לא הושלם — נסו שוב"
      );
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <section className="card px-4 py-4 text-sm font-medium text-olive-500">
        ✓ החשבון נשמר — עכשיו אפשר להיכנס לטיול מכל טלפון
      </section>
    );
  }

  return (
    <section className="card space-y-3 border-lemon-300 bg-lemon-100/60 px-4 py-4">
      <h2 className="font-display text-lg font-medium text-ink-900">
        🔐 שמרו את הגישה שלכם
      </h2>
      <p className="text-sm leading-relaxed text-ink-700">
        נכנסתם בלי חשבון, אז הגישה שמורה רק בטלפון הזה. חברו Google או Apple
        כדי לא לאבד אותה — הכל נשאר בדיוק כמו שהוא.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => link("google")}
          className="btn flex-1 border border-cream-200 bg-white py-3 text-ink-900"
        >
          {busy ? "רגע…" : "Google"}
        </button>
        {showApple && (
          <button
            type="button"
            disabled={busy}
            onClick={() => link("apple")}
            className="btn flex-1 bg-ink-900 py-3 text-cream-50"
          >
            Apple
          </button>
        )}
      </div>
      {message && <p className="text-sm text-terra-600">{message}</p>}
    </section>
  );
}
