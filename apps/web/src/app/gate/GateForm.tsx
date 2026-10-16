"use client";

import { useEffect, useState } from "react";
import {
  GoogleAuthProvider,
  getRedirectResult,
  signInWithCustomToken,
  signInWithRedirect,
  updateProfile,
  type User,
} from "firebase/auth";
import { ChevronLeft } from "lucide-react";
import { auth, signInWithGoogle } from "@/lib/firebase/client";
import { TRIPS, type TripKey } from "@/lib/trips";
import { STROKE } from "@/components/ui/Icon";
import { useT } from "@/i18n";

type Step =
  | "idle"
  | "googling"
  | "join" // signed in with Google, needs the one-time join code
  | "establishing"
  | "password" // fallback: shared trip password
  | "kids-code" // kids without email: join code first
  | "kids-pick"; // then pick your own name

interface KidFamily {
  id: string;
  name: string;
  members: { id: string; name: string }[];
}

export function GateForm({ tripKey = "sicily" }: { tripKey?: TripKey }) {
  const trip = TRIPS[tripKey];
  const t = useT();
  const home = trip.prefix || "/";
  const [step, setStep] = useState<Step>("idle");
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [kidFamilies, setKidFamilies] = useState<KidFamily[]>([]);
  const [kidFamilyId, setKidFamilyId] = useState<string | null>(null);
  const [kidBusy, setKidBusy] = useState(false);

  async function handleKidsCode(event: React.FormEvent) {
    event.preventDefault();
    if (!joinCode.trim() || kidBusy) return;
    setKidBusy(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/auth/kid-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ joinCode, tripId: trip.id }),
      });
      if (!response.ok) {
        setErrorMessage(
          response.status === 401 ? t("settings.gate.wrongCode") : t("common.errors.generic")
        );
        return;
      }
      const { families } = await response.json();
      setKidFamilies(families);
      setStep("kids-pick");
    } catch {
      setErrorMessage(t("common.errors.network"));
    } finally {
      setKidBusy(false);
    }
  }

  async function handleKidPick(familyId: string, memberId: string) {
    if (kidBusy) return;
    setKidBusy(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/auth/kid-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ joinCode, familyId, memberId, tripId: trip.id }),
      });
      if (!response.ok) {
        setErrorMessage(t("common.errors.generic"));
        return;
      }
      const { token, displayName } = await response.json();
      const credential = await signInWithCustomToken(auth(), token);
      await updateProfile(credential.user, { displayName }).catch(
        () => undefined
      );
      window.location.replace(home);
    } catch {
      setErrorMessage(t("settings.gate.signInFailed"));
      setKidBusy(false);
    }
  }

  async function establishSession(user: User, code?: string) {
    setStep("establishing");
    setErrorMessage("");
    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, joinCode: code, tripId: trip.id }),
      });
      if (response.ok) {
        window.location.replace(home);
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
        setErrorMessage(t("settings.gate.wrongCode"));
        return;
      }
      setStep("idle");
      setErrorMessage(t("settings.gate.tryLater"));
    } catch {
      setStep(googleUser ? "join" : "idle");
      setErrorMessage(t("common.errors.network"));
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
          setErrorMessage(t("settings.gate.signInIncomplete"));
        });
        return;
      }
      setStep("idle");
      if (!code.includes("popup-closed") && !code.includes("cancelled")) {
        setErrorMessage(t("settings.gate.signInIncomplete"));
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
        window.location.replace(home);
        return;
      }
      setStep("password");
      setErrorMessage(
        response.status === 401 ? t("settings.gate.wrongPassword") : t("common.errors.generic")
      );
    } catch {
      setStep("password");
      setErrorMessage(t("common.errors.network"));
    }
  }

  const busy = step === "googling" || step === "establishing";

  const fieldClass =
    "mt-3 w-full rounded-xl border border-cream-300 bg-white px-4 py-3.5 text-center text-lg tracking-wide text-ink-900 outline-none transition focus:border-sea-500 focus:ring-2 focus:ring-sea-200";
  const backButton = (onClick: () => void, label: string = t("settings.gate.back")) => (
    <button
      type="button"
      onClick={onClick}
      className="mt-4 inline-flex w-full items-center justify-center gap-1 text-sm text-ink-500"
    >
      <ChevronLeft size={16} strokeWidth={STROKE} aria-hidden className="rtl:rotate-180" />
      {label}
    </button>
  );

  return (
    <div className="mt-10">
      <div className="rounded-2xl border border-white/40 bg-cream-50/95 p-6 text-start shadow-2xl shadow-sea-950/40 backdrop-blur">
        {step === "join" ? (
          <form onSubmit={handleJoinSubmit}>
            <p className="font-display text-lg font-normal text-ink-900">
              {t("settings.gate.hi", {
                name: googleUser?.displayName?.split(" ")[0] ?? "",
              })}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-ink-500">
              {t("settings.gate.joinHint")}
            </p>
            <input
              type="text"
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value)}
              autoFocus
              className={fieldClass}
              placeholder={t("settings.gate.joinCode")}
              aria-label={t("settings.gate.joinCode")}
            />
            <button
              type="submit"
              disabled={busy || !joinCode.trim()}
              className="btn-primary mt-3 w-full py-3.5 text-base"
            >
              {busy ? t("settings.gate.wait") : t("settings.gate.joinTrip")}
            </button>
          </form>
        ) : step === "kids-code" ? (
          <form onSubmit={handleKidsCode}>
            <p className="font-display text-lg font-normal text-ink-900">
              {trip.group.quickLoginTitle}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-ink-500">
              {trip.group.quickLoginHint}
            </p>
            <input
              type="text"
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value)}
              autoFocus
              className={fieldClass}
              placeholder={t("settings.gate.tripCode")}
              aria-label={t("settings.gate.tripCode")}
            />
            <button
              type="submit"
              disabled={kidBusy || !joinCode.trim()}
              className="btn-primary mt-3 w-full py-3.5 text-base"
            >
              {kidBusy ? t("settings.gate.wait") : t("common.continue")}
            </button>
            {backButton(() => {
              setStep("idle");
              setErrorMessage("");
            })}
          </form>
        ) : step === "kids-pick" ? (
          <div>
            <p className="font-display text-lg font-normal text-ink-900">
              {kidFamilyId ? trip.group.pickNamePrompt : trip.group.pickUnitPrompt}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {kidFamilies.map((family) => (
                <button
                  key={family.id}
                  type="button"
                  onClick={() =>
                    setKidFamilyId(kidFamilyId === family.id ? null : family.id)
                  }
                  className={`rounded-full border px-4 py-2 text-sm transition ${
                    kidFamilyId === family.id
                      ? "border-sea-900 bg-sea-900 text-cream-50"
                      : "border-cream-300 bg-white text-ink-700"
                  }`}
                >
                  <bdi>{family.name}</bdi>
                </button>
              ))}
            </div>
            {kidFamilyId && (
              <div className="mt-3 flex flex-wrap gap-2 rounded-xl bg-cream-100 p-3">
                {kidFamilies
                  .find((f) => f.id === kidFamilyId)
                  ?.members.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      disabled={kidBusy}
                      onClick={() => handleKidPick(kidFamilyId, member.id)}
                      className="rounded-full bg-white px-4 py-2 text-sm text-ink-900 transition active:scale-[0.97] disabled:opacity-50"
                    >
                      {kidBusy ? "…" : member.name}
                    </button>
                  ))}
              </div>
            )}
            {backButton(() => {
              setStep("idle");
              setKidFamilyId(null);
              setErrorMessage("");
            })}
          </div>
        ) : step === "password" ? (
          <form onSubmit={handlePasswordSubmit}>
            <label
              htmlFor="trip-password"
              className="block text-sm text-ink-700"
            >
              {t("settings.gate.password")}
            </label>
            <input
              id="trip-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              dir="ltr"
              className="mt-2 w-full rounded-xl border border-cream-300 bg-white px-4 py-3.5 text-lg text-ink-900 outline-none transition focus:border-sea-500 focus:ring-2 focus:ring-sea-200"
              placeholder="••••••••"
            />
            <button
              type="submit"
              disabled={busy || !password.trim()}
              className="btn-primary mt-3 w-full py-3.5 text-base"
            >
              {busy ? t("settings.gate.wait") : t("settings.gate.enter")}
            </button>
            {backButton(() => {
              setStep("idle");
              setErrorMessage("");
            }, t("settings.gate.backToGoogle"))}
          </form>
        ) : (
          <>
            <button
              type="button"
              onClick={handleGoogle}
              disabled={busy}
              className="btn-primary w-full gap-3 py-3.5 text-base"
            >
              <GoogleLogo />
              {busy ? t("settings.gate.connecting") : t("settings.gate.google")}
            </button>
            <p className="mt-3 text-center text-xs text-ink-500">
              {t("settings.gate.remember")}
            </p>
            <button
              type="button"
              onClick={() => {
                setStep("kids-code");
                setErrorMessage("");
              }}
              className="btn-outline mt-5 w-full py-3 text-sm"
            >
              {trip.group.quickLoginTitle}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("password");
                setErrorMessage("");
              }}
              className="mt-4 w-full text-center text-sm text-ink-500 underline-offset-4 hover:underline"
            >
              {t("settings.gate.passwordFallback")}
            </button>
          </>
        )}

        {errorMessage && (
          <p
            role="alert"
            className="mt-3 text-center text-sm text-terra-600"
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
      className="flex h-6 w-6 items-center justify-center rounded-full bg-white"
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
