"use client";

import { useState } from "react";

export function GateForm() {
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!password.trim() || status === "loading") return;

    setStatus("loading");
    setErrorMessage("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        // Full navigation so the proxy re-evaluates the new cookie
        window.location.replace("/");
        return;
      }

      setStatus("error");
      setErrorMessage(
        response.status === 401
          ? "הסיסמה לא נכונה, נסו שוב"
          : "משהו השתבש, נסו שוב עוד רגע"
      );
    } catch {
      setStatus("error");
      setErrorMessage("אין חיבור לרשת, נסו שוב");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-10">
      <div className="rounded-3xl bg-cream-50/95 p-5 shadow-2xl shadow-sea-900/40 backdrop-blur">
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
          inputMode="text"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            if (status === "error") setStatus("idle");
          }}
          className="mt-2 w-full rounded-2xl border border-cream-300 bg-white px-4 py-3.5 text-lg text-ink-900 outline-none transition focus:border-sea-500 focus:ring-2 focus:ring-sea-200"
          placeholder="••••••••"
          aria-invalid={status === "error"}
          aria-describedby={status === "error" ? "gate-error" : undefined}
        />

        {status === "error" && (
          <p
            id="gate-error"
            role="alert"
            className="mt-2 text-right text-sm font-medium text-terra-600"
          >
            {errorMessage}
          </p>
        )}

        <button
          type="submit"
          disabled={status === "loading" || password.trim().length === 0}
          className="mt-4 w-full rounded-2xl bg-sea-600 py-3.5 text-lg font-semibold text-cream-50 transition active:scale-[0.98] disabled:opacity-50"
        >
          {status === "loading" ? "רק רגע…" : "כניסה לטיול"}
        </button>
      </div>
    </form>
  );
}
