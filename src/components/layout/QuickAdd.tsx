"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const QUICK_ACTIONS = [
  { emoji: "📍", label: "הוסף מקום", href: "/places/new" },
  { emoji: "📅", label: "הוסף אירוע", href: "/calendar/new" },
  { emoji: "💶", label: "הוסף הוצאה", href: "/expenses?add=1" },
  { emoji: "🗳️", label: "צור סקר", href: "/polls/new" },
  { emoji: "✨", label: "שאל את ה-AI", href: "/ai" },
] as const;

export function QuickAdd() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="הוספה מהירה"
        className="fixed bottom-24 left-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-terra-500 text-cream-50 shadow-lg shadow-terra-600/30 transition active:scale-95"
      >
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          aria-hidden
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="סגירה"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink-900/40 backdrop-blur-[2px]"
          />
          <div className="absolute inset-x-0 bottom-0 mx-auto max-w-lg rounded-t-3xl bg-cream-50 p-5 pb-safe shadow-2xl">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-cream-300" />
            <h2 className="mb-3 text-lg font-semibold text-ink-900">
              מה מוסיפים?
            </h2>
            <ul className="mb-2 space-y-1 pb-4">
              {QUICK_ACTIONS.map(({ emoji, label, href }) =>
                href ? (
                  <li key={label}>
                    <Link
                      href={href}
                      onClick={() => setOpen(false)}
                      className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-right text-lg text-ink-900 transition active:bg-cream-100"
                    >
                      <span className="text-2xl" aria-hidden>
                        {emoji}
                      </span>
                      <span className="flex-1">{label}</span>
                      <span aria-hidden className="text-ink-300">
                        ‹
                      </span>
                    </Link>
                  </li>
                ) : (
                  <li key={label}>
                    <div className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-right text-lg text-ink-700 opacity-60">
                      <span className="text-2xl" aria-hidden>
                        {emoji}
                      </span>
                      <span className="flex-1">{label}</span>
                      <span className="rounded-full bg-lemon-100 px-2.5 py-0.5 text-xs font-medium text-ink-700">
                        בשלב הבא
                      </span>
                    </div>
                  </li>
                )
              )}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
