"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { logoutEverywhere } from "@/lib/logout";

/** "עוד" menu row: full logout back to the gate. */
export function LogoutRow() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        logoutEverywhere();
      }}
      className="flex w-full items-center gap-4 rounded-3xl border border-terra-100 bg-white px-4 py-4 text-right transition active:bg-terra-100/40 disabled:opacity-60"
    >
      <span className="text-2xl" aria-hidden>
        🚪
      </span>
      <span className="flex-1">
        <span className="block font-semibold text-terra-600">
          {busy ? "מתנתקים…" : "התנתקות"}
        </span>
        <span className="block text-sm text-ink-500">
          יציאה מהחשבון וחזרה למסך הכניסה
        </span>
      </span>
      <LogOut size={18} className="text-terra-400" />
    </button>
  );
}
