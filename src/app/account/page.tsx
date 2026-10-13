"use client";

import { useState } from "react";
import { signOut } from "firebase/auth";
import { SignInPanel } from "@/components/auth/SignInPanel";
import { ProductShell } from "@/components/product/ProductShell";
import { apiFetch, auth } from "@/lib/firebase/client";
import { useAuthUser } from "@/lib/use-auth-user";

export default function AccountPage() {
  const { user, personal, loading } = useAuthUser();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function deleteAccount() {
    setBusy(true);
    setError("");
    try {
      const response = await apiFetch("/api/account", { method: "DELETE" });
      if (!response.ok) throw new Error();
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
      await signOut(auth()).catch(() => undefined);
      window.location.replace("/welcome");
    } catch {
      setError(
        "המחיקה נכשלה. אם התחברתם מזמן — התנתקו, התחברו מחדש ונסו שוב."
      );
      setBusy(false);
    }
  }

  return (
    <ProductShell>
      <h1 className="font-display text-3xl font-bold text-ink-900">החשבון שלי</h1>
      {loading ? null : !personal || !user ? (
        <div className="card mt-6 px-5 py-6">
          <SignInPanel />
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          <div className="card px-5 py-4">
            <p className="font-semibold text-ink-900">{user.displayName}</p>
            <p className="text-sm text-ink-500" dir="ltr">
              {user.email}
            </p>
          </div>
          <section className="card space-y-3 border-terra-100 px-5 py-5">
            <h2 className="font-display text-lg font-bold text-terra-600">
              מחיקת החשבון
            </h2>
            <p className="text-sm leading-relaxed text-ink-500">
              נמחק את הפרופיל שלכם ונוציא אתכם מכל הטיולים. טיולים שאתם
              מארגנים יועברו לארכיון. אי אפשר לבטל את הפעולה.
            </p>
            {confirming ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={deleteAccount}
                  className="btn-accent flex-1 py-3"
                >
                  {busy ? "מוחקים…" : "כן, למחוק לצמיתות"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="btn-soft px-5 py-3"
                >
                  ביטול
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="btn-outline w-full border-terra-100 py-3 text-terra-600"
              >
                מחיקת החשבון
              </button>
            )}
            {error && <p className="text-sm text-terra-600">{error}</p>}
          </section>
        </div>
      )}
    </ProductShell>
  );
}
