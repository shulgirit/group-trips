"use client";

import { useEffect, useState } from "react";
import { Check, Lock } from "lucide-react";
import { useSession } from "@/components/providers/SessionProvider";
import { STROKE } from "@/components/ui/Icon";
import { useT } from "@/i18n";
import { SURFACE } from "@/components/settings/SettingsGroup";
import { appleSignInAvailable, signInWithProvider } from "@/lib/sign-in";

/**
 * Guests (joined without an account) can attach Google/Apple later — their
 * trips move to the account, so nothing is lost and it opens on any phone.
 */
export function SaveAccountCard() {
  const t = useT();
  const { user } = useSession();
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
      // Redirects to the provider; the guest's trips move to the account on return
      await signInWithProvider(kind);
      setDone(true);
    } catch {
      setMessage(t("product.saveAccount.failed"));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div role="status" className={`${SURFACE} flex items-center gap-3 p-4 text-sm font-medium text-route-700`}>
        <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-route-100">
          <Check size={18} strokeWidth={STROKE} />
        </span>
        {t("product.saveAccount.done")}
      </div>
    );
  }

  return (
    <div className={`${SURFACE} p-4 ring-1 ring-route-300/70`}>
      <div className="flex items-start gap-3">
        <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-route-100 text-route-700">
          <Lock size={18} strokeWidth={STROKE} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-medium text-ink-900">{t("product.saveAccount.title")}</h3>
          <p className="mt-0.5 text-sm leading-relaxed text-ink-500">{t("product.saveAccount.text")}</p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => link("google")}
          className="btn-outline min-h-11 flex-1 text-sm"
        >
          {busy ? t("product.saveAccount.wait") : "Google"}
        </button>
        {showApple && (
          <button
            type="button"
            disabled={busy}
            onClick={() => link("apple")}
            className="btn min-h-11 flex-1 bg-ink-900 text-sm text-cream-50"
          >
            Apple
          </button>
        )}
      </div>
      {message && <p role="alert" className="mt-2 text-sm text-terra-600">{message}</p>}
    </div>
  );
}
