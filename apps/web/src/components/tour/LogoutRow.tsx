"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { logoutEverywhere } from "@/lib/logout";
import { STROKE } from "@/components/ui/Icon";
import { useT } from "@/i18n";

/** More-menu row: full logout back to the gate. */
export function LogoutRow() {
  const t = useT();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        logoutEverywhere();
      }}
      className="flex min-h-16 w-full items-center gap-4 px-4 py-3 text-start transition active:bg-terra-100/40 disabled:opacity-60"
    >
      <span
        aria-hidden
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-terra-200 text-terra-600"
      >
        <LogOut size={18} strokeWidth={STROKE} className="rtl:rotate-180" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-terra-600">
          {busy ? t("settings.logout.busy") : t("settings.logout.title")}
        </span>
        <span className="block text-sm text-ink-500">
          {t("settings.logout.description")}
        </span>
      </span>
    </button>
  );
}
