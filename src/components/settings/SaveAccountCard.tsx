"use client";

import { useEffect, useState } from "react";
import { Check, Lock } from "lucide-react";
import { useFirebase } from "@/components/providers/FirebaseProvider";
import { STROKE } from "@/components/ui/Icon";
import { useT } from "@/i18n";
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
  const t = useT();
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
          ? t("product.saveAccount.alreadyExists")
          : code === "auth/popup-closed-by-user"
            ? ""
            : t("product.saveAccount.failed")
      );
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <section className="card flex items-center gap-2.5 px-4 py-4 text-sm font-medium text-olive-500">
        <Check size={18} strokeWidth={STROKE} aria-hidden className="shrink-0" />
        {t("product.saveAccount.done")}
      </section>
    );
  }

  return (
    <section className="card space-y-3 border-lemon-300 px-4 py-5">
      <h2 className="flex items-center gap-2 font-display text-lg font-normal text-ink-900">
        <Lock size={18} strokeWidth={STROKE} aria-hidden className="shrink-0 text-lemon-500" />
        {t("product.saveAccount.title")}
      </h2>
      <p className="text-sm leading-relaxed text-ink-700">{t("product.saveAccount.text")}</p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => link("google")}
          className="btn flex-1 border border-cream-200 bg-white py-3 text-ink-900"
        >
          {busy ? t("product.saveAccount.wait") : "Google"}
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
