"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { SignInPanel } from "@/components/auth/SignInPanel";
import { ProductShell } from "@/components/product/ProductShell";
import { ChevronRight, FileText, LayoutGrid, ShieldCheck, UserRound } from "lucide-react";
import { LanguagePicker } from "@/components/settings/LanguagePicker";
import { SURFACE } from "@/components/settings/SettingsGroup";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { STROKE } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { useT } from "@/i18n";
import { authClient } from "@/lib/convex";
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
      // Trips pass to another organizer (or are deleted) on the server first
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
      <h1 className="font-display text-3xl font-light text-ink-900">{t("product.account.title")}</h1>
      {loading ? (
        <div aria-busy className="mt-6 space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : !personal || !user ? (
        <div className={`${SURFACE} mt-6 px-5 py-6`}>
          <SignInPanel />
        </div>
      ) : (
        <div className="mt-6 space-y-9">
          {/* Profile */}
          <div className={`${SURFACE} flex items-center gap-4 p-4`}>
            <span
              aria-hidden
              className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-cream-100 text-lg font-medium text-ink-700"
            >
              {user.photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element -- remote profile photo
                <img src={user.photoURL} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : user.displayName ? (
                user.displayName.slice(0, 1)
              ) : (
                <UserRound size={24} strokeWidth={STROKE} />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-medium text-ink-900">
                <bdi>{user.displayName}</bdi>
              </p>
              <p className="truncate text-sm text-ink-500">
                <bdi dir="ltr">{user.email}</bdi>
              </p>
            </div>
          </div>

          <Link
            href="/trips"
            className={`${SURFACE} flex min-h-16 items-center gap-4 px-4 py-3 transition active:bg-cream-100`}
          >
            <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cream-200 text-ink-700">
              <LayoutGrid size={18} strokeWidth={STROKE} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-ink-900">{t("settings.more.myTrips")}</span>
              <span className="block text-sm text-ink-500">{t("settings.more.myTripsDescription")}</span>
            </span>
            <ChevronRight size={16} strokeWidth={STROKE} aria-hidden className="shrink-0 text-ink-300 rtl:rotate-180" />
          </Link>

          <section aria-labelledby="account-prefs" className="space-y-3">
            <h2 id="account-prefs" className="font-display text-2xl font-medium text-ink-900">
              {t("settings.accountPage.preferences")}
            </h2>
            <LanguagePicker />
          </section>

          <section aria-labelledby="account-legal" className="space-y-3">
            <h2 id="account-legal" className="font-display text-2xl font-medium text-ink-900">
              {t("product.account.yourData")}
            </h2>
            <ul className={`${SURFACE} divide-y divide-cream-200/80 overflow-hidden`}>
              {[
                { href: "/privacy", label: t("product.account.privacyLink"), Icon: ShieldCheck },
                { href: "/terms", label: t("product.account.termsLink"), Icon: FileText },
              ].map(({ href, label, Icon }) => (
                <li key={href}>
                  <Link href={href} className="flex min-h-14 items-center gap-4 px-4 py-3 transition active:bg-cream-100">
                    <Icon size={18} strokeWidth={STROKE} aria-hidden className="shrink-0 text-ink-500" />
                    <span className="min-w-0 flex-1 text-ink-900">{label}</span>
                    <ChevronRight size={16} strokeWidth={STROKE} aria-hidden className="shrink-0 text-ink-300 rtl:rotate-180" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="account-danger" className="space-y-3">
            <h2 id="account-danger" className="font-display text-2xl font-medium text-ink-900">
              {t("product.admin.dangerTitle")}
            </h2>
            <div className="rounded-2xl border border-terra-200 bg-white p-4">
              <p className="text-[15px] font-medium text-terra-600">{t("product.account.deleteTitle")}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-500">
                {t("product.account.deleteText")}
              </p>
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="btn-outline mt-3 min-h-11 w-full border-terra-200 text-terra-600"
              >
                {t("product.account.deleteTitle")}
              </button>
            </div>
          </section>

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
