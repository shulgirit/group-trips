"use client";

import { Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { STROKE } from "@/components/ui/Icon";
import { useT } from "@/i18n";
import { appleSignInAvailable, sendEmailCode, signInWithProvider, verifyEmailCode } from "@/lib/sign-in";

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

/**
 * Google / Apple (redirect to the provider and back) and a 6-digit email
 * code. onSignedIn runs after an email sign-in; social sign-ins return to
 * this page signed in.
 */
export function SignInPanel({
  onSignedIn,
  tone = "light",
}: {
  onSignedIn?: () => void;
  tone?: "light" | "dark";
}) {
  const t = useT();
  const [busy, setBusy] = useState<"google" | "apple" | "email" | null>(null);
  const [error, setError] = useState("");
  // Decided after mount (avoids hydration drift)
  const [showApple, setShowApple] = useState(false);
  useEffect(() => setShowApple(appleSignInAvailable()), []);
  const [emailStep, setEmailStep] = useState<"closed" | "address" | "code">("closed");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");

  async function social(kind: "google" | "apple") {
    if (busy) return;
    setBusy(kind);
    setError("");
    try {
      await signInWithProvider(kind);
    } catch {
      setError(t("product.signIn.failed"));
      setBusy(null);
    }
  }

  async function sendCode(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !/^\S+@\S+\.\S+$/.test(email.trim())) return;
    setBusy("email");
    setError("");
    try {
      await sendEmailCode(email);
      setEmailStep("code");
    } catch {
      setError(t("product.signIn.sendFailed"));
    } finally {
      setBusy(null);
    }
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (busy || code.trim().length < 6) return;
    setBusy("email");
    setError("");
    try {
      await verifyEmailCode(email, code);
      onSignedIn?.();
    } catch {
      setError(t("product.signIn.invalidCode"));
    } finally {
      setBusy(null);
    }
  }

  const fieldClass =
    tone === "dark"
      ? "w-full rounded-xl border border-cream-50/20 bg-night-800 px-4 py-3.5 text-base text-cream-50 placeholder:text-cream-50/40"
      : "field py-3.5 text-base";
  const quietButton = tone === "dark" ? "text-cream-50/75" : "text-ink-500";

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => social("google")}
        disabled={Boolean(busy)}
        className="btn w-full border border-cream-200 bg-white py-3.5 text-base font-medium text-ink-900"
      >
        <GoogleGlyph />
        {busy === "google" ? t("product.signIn.connecting") : t("product.signIn.google")}
      </button>
      {showApple && (
        <button
          type="button"
          onClick={() => social("apple")}
          disabled={Boolean(busy)}
          className="btn w-full bg-ink-900 py-3.5 text-base font-medium text-cream-50"
        >
          <AppleGlyph />
          {busy === "apple" ? t("product.signIn.connecting") : t("product.signIn.apple")}
        </button>
      )}

      {emailStep === "closed" && (
        <button
          type="button"
          onClick={() => setEmailStep("address")}
          disabled={Boolean(busy)}
          className={`btn w-full py-3.5 text-base font-medium ${tone === "dark" ? "border border-cream-50/25 text-cream-50" : "btn-outline"}`}
        >
          <Mail size={18} strokeWidth={STROKE} aria-hidden />
          {t("product.signIn.email")}
        </button>
      )}

      {emailStep === "address" && (
        <form onSubmit={sendCode} className="space-y-2">
          <label className="sr-only" htmlFor="sign-in-email">
            {t("product.signIn.emailLabel")}
          </label>
          <input
            id="sign-in-email"
            type="email"
            dir="ltr"
            autoComplete="email"
            inputMode="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("product.signIn.emailPlaceholder")}
            className={fieldClass}
          />
          <button type="submit" disabled={Boolean(busy)} className="btn-primary w-full py-3.5 text-base">
            {busy === "email" ? t("product.signIn.connecting") : t("product.signIn.sendCode")}
          </button>
        </form>
      )}

      {emailStep === "code" && (
        <form onSubmit={verify} className="space-y-2">
          <p className={`text-center text-sm ${quietButton}`}>
            {t("product.signIn.codeSent", { email: email.trim() })}
          </p>
          <label className="sr-only" htmlFor="sign-in-code">
            {t("product.signIn.codeLabel")}
          </label>
          <input
            id="sign-in-code"
            dir="ltr"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className={`${fieldClass} text-center text-2xl tracking-[0.4em] tabular-nums`}
          />
          <button type="submit" disabled={Boolean(busy) || code.length < 6} className="btn-primary w-full py-3.5 text-base">
            {busy === "email" ? t("product.signIn.connecting") : t("product.signIn.verify")}
          </button>
          <button
            type="button"
            onClick={() => {
              setEmailStep("address");
              setCode("");
              setError("");
            }}
            className={`w-full py-2 text-sm ${quietButton}`}
          >
            {t("product.signIn.changeEmail")}
          </button>
        </form>
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
