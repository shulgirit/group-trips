"use client";

import { useEffect, useState } from "react";
import { GoogleAuthProvider, getRedirectResult, signInWithRedirect, type User } from "firebase/auth";
import { auth, signInWithGoogle } from "@/lib/firebase/client";

type Step =
  | "idle"
  | "googling"
  | "join" // signed in with Google, needs the one-time join code
  | "establishing"
  | "password"; // fallback: shared trip password

export function GateForm() {
  const [step, setStep] = useState<Step>("idle");
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function establishSession(user: User, code?: string) {
    setStep("establishing");
    setErrorMessage("");
    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, joinCode: code }),
      });
      if (response.ok) {
        window.location.replace("/");
        return;
      }
      const { error } = await response.json().catch(() => ({ error: "" }));
      if (error === "join_required") {
        setGoogleUser(user);
        setStep("join");
        return;
      }
      if (error === "wrong_code") {
        setGoogleUser(user);
        setStep("join");
        setErrorMessage("קוד לא נכון — נסו שוב");
        return;
      }
      setStep("idle");
      setErrorMessage("משהו השתבש, נסו שוב עוד רגע");
    } catch {
      setStep(googleUser ? "join" : "idle");
      setErrorMessage("אין חיבור לרשת, נסו שוב");
    }
  }

  // Handle return from signInWithRedirect (popup-blocked fallback)
  useEffect(() => {
    getRedirectResult(auth())
      .then((result) => {
        if (result?.user) establishSession(result.user);
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleGoogle() {
    if (step === "googling" || step === "establishing") return;
    setStep("googling");
    setErrorMessage("");
    try {
      const user = await signInWithGoogle();
      await establishSession(user);
    } catch (error) {
      const code = (error as { code?: string })?.code ?? "";
      if (code.includes("popup-blocked") || code.includes("operation-not-supported")) {
        await signInWithRedirect(auth(), new GoogleAuthProvider()).catch(() => {
          setStep("idle");
          setErrorMessage("ההתחברות לא הושלמה, נסו שוב");
        });
        return;
      }
      setStep("idle");
      if (!code.includes("popup-closed") && !code.includes("cancelled")) {
        setErrorMessage("ההתחברות לא הושלמה, נסו שוב");
      }
    }
  }

  async function handleJoinSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!googleUser || !joinCode.trim()) return;
    await establishSession(googleUser, joinCode);
  }

  async function handlePasswordSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!password.trim()) return;
    setStep("establishing");
    setErrorMessage("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (response.ok) {
        window.location.replace("/");
        return;
      }
      setStep("password");
      setErrorMessage(
        response.status === 401 ? "הסיסמה לא נכונה" : "משהו השתבש, נסו שוב"
      );
    } catch {
      setStep("password");
      setErrorMessage("אין חיבור לרשת, נסו שוב");
    }
  }

  const busy = step === "googling" || step === "establishing";

  return (
    <div className="mt-10">
      <div className="rounded-3xl bg-cream-50/95 p-5 shadow-2xl shadow-sea-900/40 backdrop-blur">
        {step === "join" ? (
          <form onSubmit={handleJoinSubmit}>
            <p className="text-right font-semibold text-ink-900">
              היי {googleUser?.displayName?.split(" ")[0] ?? ""} 👋
            </p>
            <p className="mt-1 text-right text-sm text-ink-500">
              פעם ראשונה כאן — הזינו את קוד ההצטרפות מקבוצת הוואטסאפ (רק
              הפעם, לא תצטרכו אותו שוב)
            </p>
            <input
              type="text"
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value)}
              autoFocus
              className="mt-3 w-full rounded-2xl border border-cream-300 bg-white px-4 py-3.5 text-center text-lg tracking-wide text-ink-900 outline-none transition focus:border-sea-500 focus:ring-2 focus:ring-sea-200"
              placeholder="קוד הצטרפות"
              aria-label="קוד הצטרפות"
            />
            <button
              type="submit"
              disabled={busy || !joinCode.trim()}
              className="mt-3 w-full rounded-2xl bg-sea-600 py-3.5 text-lg font-semibold text-cream-50 transition active:scale-[0.98] disabled:opacity-50"
            >
              {busy ? "רק רגע…" : "הצטרפות לטיול"}
            </button>
          </form>
        ) : step === "password" ? (
          <form onSubmit={handlePasswordSubmit}>
            <label
              htmlFor="trip-password"
              className="block text-right text-sm font-medium text-ink-700"
            >
              סיסמת הטיול
            </label>
            <input
              id="trip-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-cream-300 bg-white px-4 py-3.5 text-lg text-ink-900 outline-none transition focus:border-sea-500 focus:ring-2 focus:ring-sea-200"
              placeholder="••••••••"
            />
            <button
              type="submit"
              disabled={busy || !password.trim()}
              className="mt-3 w-full rounded-2xl bg-sea-600 py-3.5 text-lg font-semibold text-cream-50 transition active:scale-[0.98] disabled:opacity-50"
            >
              {busy ? "רק רגע…" : "כניסה"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("idle");
                setErrorMessage("");
              }}
              className="mt-3 w-full text-center text-sm text-sea-600"
            >
              › חזרה להתחברות עם Google
            </button>
          </form>
        ) : (
          <>
            <button
              type="button"
              onClick={handleGoogle}
              disabled={busy}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-sea-600 py-4 text-lg font-semibold text-cream-50 transition active:scale-[0.98] disabled:opacity-60"
            >
              <GoogleLogo />
              {busy ? "מתחברים…" : "התחברות עם Google"}
            </button>
            <p className="mt-3 text-center text-xs text-ink-500">
              נכנסים פעם אחת — והאפליקציה זוכרת אתכם
            </p>
            <button
              type="button"
              onClick={() => {
                setStep("password");
                setErrorMessage("");
              }}
              className="mt-3 w-full text-center text-sm text-ink-500 underline-offset-2 hover:underline"
            >
              בעיה עם Google? כניסה עם סיסמת הטיול
            </button>
          </>
        )}

        {errorMessage && (
          <p
            role="alert"
            className="mt-3 text-center text-sm font-medium text-terra-600"
          >
            {errorMessage}
          </p>
        )}
      </div>
    </div>
  );
}

function GoogleLogo() {
  return (
    <span
      aria-hidden
      className="flex h-7 w-7 items-center justify-center rounded-full bg-white"
    >
      <svg width="16" height="16" viewBox="0 0 48 48">
        <path
          fill="#EA4335"
          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
        />
        <path
          fill="#4285F4"
          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
        />
        <path
          fill="#FBBC05"
          d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
        />
        <path
          fill="#34A853"
          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
        />
      </svg>
    </span>
  );
}
