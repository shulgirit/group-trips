"use client";

import { useEffect } from "react";

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
        aria-label="סגירה"
        onClick={onClose}
        className="absolute inset-0 bg-ink-900/40 backdrop-blur-[2px]"
      />
      <div className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[88dvh] max-w-lg flex-col rounded-t-3xl bg-cream-50 shadow-2xl">
        <div className="relative px-5 pt-3">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-cream-300" />
          <h2 className="mb-2 pe-8 text-lg font-semibold text-ink-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגירה"
            className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-cream-100 text-ink-500"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-8 pb-safe">{children}</div>
      </div>
    </div>
  );
}
