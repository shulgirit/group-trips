"use client";

import { useEffect, useState } from "react";
import {
  appleSignInAvailable,
  signInWithApple,
  signInWithGoogle,
} from "@/lib/firebase/client";
import { useT, type TKey } from "@/i18n";

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function AppleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
      <path d="M16.37 12.6c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.73-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.87-.76a4.26 4.26 0 0 0-3.6 2.18c-1.54 2.67-.39 6.62 1.1 8.79.74 1.06 1.61 2.25 2.75 2.2 1.1-.04 1.52-.71 2.86-.71 1.33 0 1.71.71 2.88.69 1.19-.02 1.94-1.08 2.66-2.15a9.4 9.4 0 0 0 1.21-2.47 3.84 3.84 0 0 1-2.36-3.53zM14.19 6.13c.6-.74 1.02-1.76.9-2.78-.88.04-1.94.59-2.57 1.32-.56.65-1.06 1.7-.93 2.7.98.08 1.98-.5 2.6-1.24z" />
    </svg>
  );
}

/** Firebase auth error → message key (null = silent, e.g. user closed the popup). */
const ERRORS: Record<string, TKey | null> = {
  "auth/popup-closed-by-user": null,
  "auth/cancelled-popup-request": null,
  "auth/network-request-failed": "product.signIn.network",
};

/** Google / Apple sign-in buttons. Calls onSignedIn after success. */
export function SignInPanel({
  onSignedIn,
  tone = "light",
}: {
  onSignedIn?: () => void;
  tone?: "light" | "dark";
}) {
  const t = useT();
  const [busy, setBusy] = useState<"google" | "apple" | null>(null);
  const [error, setError] = useState("");
  // Decided after mount — depends on the native shell (avoids hydration drift)
  const [showApple, setShowApple] = useState(false);
  useEffect(() => setShowApple(appleSignInAvailable()), []);

  async function run(kind: "google" | "apple") {
    if (busy) return;
    setBusy(kind);
    setError("");
    try {
      await (kind === "google" ? signInWithGoogle() : signInWithApple());
      onSignedIn?.();
    } catch (err) {
      const code = (err as { code?: string }).code ?? "";
      const key = code in ERRORS ? ERRORS[code] : "product.signIn.failed";
      setError(key ? t(key) : "");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => run("google")}
        disabled={Boolean(busy)}
        className="btn w-full border border-cream-200 bg-white py-3.5 text-base font-medium text-ink-900"
      >
        <GoogleGlyph />
        {busy === "google" ? t("product.signIn.connecting") : t("product.signIn.google")}
      </button>
      {showApple && (
        <button
          type="button"
          onClick={() => run("apple")}
          disabled={Boolean(busy)}
          className="btn w-full bg-ink-900 py-3.5 text-base font-medium text-cream-50"
        >
          <AppleGlyph />
          {busy === "apple" ? t("product.signIn.connecting") : t("product.signIn.apple")}
        </button>
      )}
      {error && (
        <p
          role="alert"
          className={`text-center text-sm font-medium ${tone === "dark" ? "text-lemon-300" : "text-terra-600"}`}
        >
          {error}
        </p>
      )}
    </div>
  );
}
