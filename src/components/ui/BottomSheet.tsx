"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { STROKE } from "@/components/ui/Icon";
import { useT } from "@/i18n";

export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const t = useT();
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label={t("common.close")}
        onClick={onClose}
        className="absolute inset-0 bg-ink-900/40 backdrop-blur-[2px]"
      />
      <div className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[88dvh] max-w-lg flex-col rounded-t-3xl border-t border-cream-200 bg-cream-50 shadow-[var(--shadow-float)]">
        <div className="relative px-5 pt-3">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-cream-300" />
          <h2 className="mb-3 pe-10 font-display text-lg font-normal text-ink-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="absolute end-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-cream-200 text-ink-500"
          >
            <X size={16} strokeWidth={STROKE} aria-hidden />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-8 pb-safe">{children}</div>
      </div>
    </div>
  );
}
