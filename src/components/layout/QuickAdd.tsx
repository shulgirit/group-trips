"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarPlus,
  ChevronLeft,
  MapPinPlus,
  Plus,
  Sparkles,
  Vote,
  Wallet,
} from "lucide-react";

const QUICK_ACTIONS = [
  { icon: MapPinPlus, label: "הוסף מקום", href: "/places/new" },
  { icon: CalendarPlus, label: "הוסף אירוע", href: "/calendar/new" },
  { icon: Wallet, label: "הוסף הוצאה", href: "/expenses?add=1" },
  { icon: Vote, label: "צור סקר", href: "/polls/new" },
  { icon: Sparkles, label: "שאל את הקונסיירז׳", href: "/ai" },
] as const;

export function QuickAdd() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

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

  // The chat input owns the bottom edge on the concierge screen
  if (pathname.startsWith("/ai")) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="הוספה מהירה"
        className="fixed bottom-24 left-4 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-terra-400 to-terra-600 text-cream-50 shadow-[var(--shadow-float)] transition active:scale-95"
      >
        <Plus size={26} strokeWidth={2.4} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="סגירה"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-sea-950/45 backdrop-blur-[2px]"
          />
          <div className="absolute inset-x-0 bottom-0 mx-auto max-w-lg rounded-t-[2rem] bg-cream-50 p-5 pb-safe shadow-2xl">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-cream-300" />
            <h2 className="mb-1 font-display text-xl font-bold text-ink-900">
              מה מוסיפים?
            </h2>
            <p className="mb-4 text-sm text-ink-500">הכל מסתנכרן לכולם מיד</p>
            <ul className="mb-4 space-y-1">
              {QUICK_ACTIONS.map(({ icon: Icon, label, href }) => (
                <li key={label}>
                  <Link
                    href={href}
                    onClick={() => setOpen(false)}
                    className="flex w-full items-center gap-4 rounded-2xl px-3 py-3.5 text-right transition active:bg-cream-100"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sea-100 text-sea-700">
                      <Icon size={21} strokeWidth={2} />
                    </span>
                    <span className="flex-1 text-lg text-ink-900">{label}</span>
                    <ChevronLeft size={18} className="text-ink-300" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
