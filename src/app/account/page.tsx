"use client";

import { useState } from "react";
import { signOut } from "firebase/auth";
import { SignInPanel } from "@/components/auth/SignInPanel";
import { ProductShell } from "@/components/product/ProductShell";
import { useT } from "@/i18n";
import { apiFetch, auth } from "@/lib/firebase/client";
import { useAuthUser } from "@/lib/use-auth-user";

export default function AccountPage() {
  const t = useT();
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
      setError(t("product.account.deleteFailed"));
      setBusy(false);
    }
  }

  return (
    <ProductShell>
      <h1 className="font-display text-3xl font-light text-ink-900">{t("product.account.title")}</h1>
      {loading ? null : !personal || !user ? (
        <div className="card mt-6 px-5 py-6">
          <SignInPanel />
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          <div className="card px-5 py-4">
            <p className="font-medium text-ink-900">{user.displayName}</p>
            <p className="text-sm text-ink-500" dir="ltr">
              {user.email}
            </p>
          </div>
          <section className="card space-y-3 px-5 py-5">
            <h2 className="font-display text-lg font-normal text-terra-600">
              {t("product.account.deleteTitle")}
            </h2>
            <p className="text-sm leading-relaxed text-ink-500">
              {t("product.account.deleteText")}
            </p>
            {confirming ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={deleteAccount}
                  className="btn-accent flex-1 py-3"
                >
                  {busy ? t("product.account.deleting") : t("product.account.confirmDelete")}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="btn-soft px-5 py-3"
                >
                  {t("common.cancel")}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="btn-outline w-full border-terra-100 py-3 text-terra-600"
              >
                {t("product.account.deleteTitle")}
              </button>
            )}
            {error && <p className="text-sm text-terra-600">{error}</p>}
          </section>
        </div>
      )}
    </ProductShell>
  );
}
