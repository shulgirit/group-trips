"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { signOut } from "firebase/auth";
import { SignInPanel } from "@/components/auth/SignInPanel";
import { ProductShell } from "@/components/product/ProductShell";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useT } from "@/i18n";
import { apiFetch, auth } from "@/lib/firebase/client";
import { useAuthUser } from "@/lib/use-auth-user";

export default function AccountPage() {
  const t = useT();
  const { user, personal, loading } = useAuthUser();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const closeDialog = useCallback(() => {
    setConfirming(false);
    setError("");
  }, []);

  async function deleteAccount() {
    setError("");
    try {
      const response = await apiFetch("/api/account", { method: "DELETE" });
      if (!response.ok) throw new Error();
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
      await signOut(auth()).catch(() => undefined);
      window.location.replace("/welcome");
    } catch {
      setError(t("product.account.deleteFailed"));
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
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="btn-outline w-full border-terra-200 py-3 text-terra-600"
            >
              {t("product.account.deleteTitle")}
            </button>
          </section>
          <p className="flex justify-center gap-4 text-sm text-ink-500">
            <Link href="/privacy" className="underline-offset-4 hover:underline">
              {t("product.account.privacyLink")}
            </Link>
            <Link href="/terms" className="underline-offset-4 hover:underline">
              {t("product.account.termsLink")}
            </Link>
          </p>
          <ConfirmDialog
            open={confirming}
            title={t("product.account.dialogTitle")}
            description={t("product.account.dialogText")}
            items={[
              t("product.account.items.profile"),
              t("product.account.items.chats"),
              t("product.account.items.documents"),
              t("product.account.items.location"),
              t("product.account.items.trips"),
              t("product.account.items.shared"),
            ]}
            confirmWord={t("common.confirm.word")}
            confirmLabel={t("product.account.confirmDelete")}
            busyLabel={t("product.account.deleting")}
            error={error}
            onConfirm={deleteAccount}
            onClose={closeDialog}
          />
        </div>
      )}
    </ProductShell>
  );
}
