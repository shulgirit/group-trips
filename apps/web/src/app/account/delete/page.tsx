"use client";

import { useCallback, useState } from "react";
import { SignInPanel } from "@/components/auth/SignInPanel";
import { ProductShell } from "@/components/product/ProductShell";
import { SURFACE } from "@/components/settings/SettingsGroup";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { useT } from "@/i18n";
import { authClient } from "@/lib/convex";
import { useAuthUser } from "@/lib/use-auth-user";

/**
 * Public "delete my account" page (the URL Google Play's data-safety form asks
 * for). Signed out: sign in first. Signed in: explains what happens and
 * deletes the account (trips pass to another organizer or are deleted).
 */
export default function DeleteAccountPage() {
  const t = useT();
  const { user, personal, loading } = useAuthUser();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const close = useCallback(() => {
    setConfirming(false);
    setError("");
  }, []);

  async function deleteAccount() {
    setError("");
    try {
      const result = await authClient.deleteUser();
      if (result.error) throw new Error(result.error.code ?? "delete_failed");
      await authClient.signOut().catch(() => undefined);
      window.location.replace("/welcome");
    } catch {
      setError(t("product.account.deleteFailed"));
    }
  }

  return (
    <ProductShell>
      <h1 className="font-display text-3xl font-light text-ink-900">{t("product.account.deleteTitle")}</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-500">{t("product.account.deleteText")}</p>
      <ul className="mt-4 list-disc space-y-1 ps-5 text-sm text-ink-700">
        {(["profile", "chats", "documents", "location", "trips", "shared"] as const).map((item) => (
          <li key={item}>{t(`product.account.items.${item}`)}</li>
        ))}
      </ul>
      {loading ? (
        <Skeleton className="mt-6 h-28 w-full" />
      ) : !personal || !user ? (
        <div className={`${SURFACE} mt-6 px-5 py-6`}>
          <SignInPanel />
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-terra-200 bg-white p-4">
          <p className="text-sm text-ink-500">
            <bdi dir="ltr">{user.email}</bdi>
          </p>
          <button type="button" onClick={() => setConfirming(true)} className="btn-outline mt-3 min-h-11 w-full border-terra-200 text-terra-600">
            {t("product.account.deleteTitle")}
          </button>
        </div>
      )}
      <ConfirmDialog
        open={confirming}
        title={t("product.account.dialogTitle")}
        description={t("product.account.dialogText")}
        confirmWord={t("common.confirm.word")}
        confirmLabel={t("product.account.confirmDelete")}
        busyLabel={t("product.account.deleting")}
        error={error}
        onConfirm={deleteAccount}
        onClose={close}
      />
    </ProductShell>
  );
}
