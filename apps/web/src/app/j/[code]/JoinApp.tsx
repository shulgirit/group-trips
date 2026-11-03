"use client";

import { Logo } from "@/components/brand/Logo";
import { StoreBadges } from "@/components/landing/StoreBadges";
import { useT } from "@/i18n";

/** Invitations are accepted in the mobile app: this page opens it (or sends people to the store first). */
export function JoinApp({ code }: { code: string }) {
  const t = useT();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <Logo size={32} wordClassName="text-lg" />
      <h1 className="font-display text-3xl font-medium text-ink-900">{t("product.join.appTitle")}</h1>
      <p className="text-ink-700">{t("product.join.appText")}</p>
      <a
        href={`together://j/${code}`}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-ink-900 px-6 font-medium text-white transition active:opacity-90"
      >
        {t("product.join.openApp")}
      </a>
      <div className="text-sm text-ink-500">
        <p>{t("product.join.codeLabel")}</p>
        <p dir="ltr" className="mt-1 font-mono text-lg tracking-widest text-ink-900">
          {code}
        </p>
      </div>
      <div className="flex w-full flex-col items-center gap-3 border-t border-chart-200/70 pt-6">
        <p className="text-sm text-ink-500">{t("product.join.getApp")}</p>
        <StoreBadges className="justify-center" />
      </div>
    </main>
  );
}
