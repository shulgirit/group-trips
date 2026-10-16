"use client";

import { useEffect, useId, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { STROKE } from "@/components/ui/Icon";
import { useT } from "@/i18n";

/**
 * Confirmation for irreversible actions. Spells out what will be deleted
 * and, when `confirmWord` is set, makes the person type it before the
 * delete button unlocks.
 */
type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  items?: string[];
  confirmWord?: string;
  confirmLabel: string;
  busyLabel?: string;
  error?: string;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
};

export function ConfirmDialog(props: ConfirmDialogProps) {
  // Mounted only while open, so the typed word and busy state start fresh
  return props.open ? <DialogBody {...props} /> : null;
}

function DialogBody({
  title,
  description,
  items,
  confirmWord,
  confirmLabel,
  busyLabel,
  error,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const t = useT();
  const titleId = useId();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const unlocked =
    !confirmWord || typed.trim().toLowerCase() === confirmWord.toLowerCase();

  async function confirm() {
    if (!unlocked || busy) return;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal
      aria-labelledby={titleId}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-ink-900/60 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center"
      onClick={() => !busy && onClose()}
    >
      <div
        className="card w-full max-w-md px-5 py-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-terra-100 text-terra-600">
            <AlertTriangle size={20} strokeWidth={STROKE} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-display text-lg font-medium text-ink-900">
              {title}
            </h2>
            <p className="kicker mt-1 text-terra-600">{t("common.confirm.irreversible")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label={t("common.close")}
            className="text-ink-500"
          >
            <X size={20} strokeWidth={STROKE} aria-hidden />
          </button>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-ink-700">{description}</p>
        {items && items.length > 0 && (
          <ul className="mt-3 space-y-1.5 rounded-xl bg-cream-100 px-4 py-3 text-sm text-ink-700">
            {items.map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-terra-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}

        {confirmWord && (
          <label className="mt-4 block">
            <span className="text-sm text-ink-700">
              {t("common.confirm.typeToConfirm", { word: confirmWord })}
            </span>
            <input
              className="field mt-1.5"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              disabled={busy}
            />
          </label>
        )}

        {error && <p className="mt-3 text-sm text-terra-600">{error}</p>}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            disabled={!unlocked || busy}
            onClick={confirm}
            className="btn-danger flex-1 py-3"
          >
            {busy ? busyLabel ?? t("common.confirm.working") : confirmLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="btn-soft px-5 py-3"
          >
            {t("common.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
