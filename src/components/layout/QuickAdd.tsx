"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTrip } from "@/components/providers/TripProvider";
import { STROKE } from "@/components/ui/Icon";
import { useT } from "@/i18n";
import {
  CalendarPlus,
  ChevronRight,
  MapPinPlus,
  Plus,
  Sparkles,
  Vote,
  Wallet,
} from "lucide-react";

export function QuickAdd() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const trip = useTrip();
  const t = useT();

  const quickActions = [
    { icon: MapPinPlus, label: t("trip.quickAdd.addPlace"), href: `${trip.prefix}/places/new`, gold: false },
    { icon: CalendarPlus, label: t("trip.quickAdd.addEvent"), href: `${trip.prefix}/calendar/new`, gold: false },
    { icon: Wallet, label: t("trip.quickAdd.addExpense"), href: `${trip.prefix}/expenses?add=1`, gold: false },
    { icon: Vote, label: t("trip.quickAdd.createPoll"), href: `${trip.prefix}/polls/new`, gold: false },
    {
      icon: Sparkles,
      label: trip.ai.quickAddLabel,
      href: `${trip.prefix}/ai`,
      gold: true,
    },
  ] as const;

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
  if (pathname.startsWith(`${trip.prefix}/ai`)) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("trip.quickAdd.aria")}
        className="fixed bottom-[calc(7rem+env(safe-area-inset-bottom))] lg:bottom-8 end-4 z-40 flex h-14 w-14 items-center justify-center rounded-2xl border border-cream-200 bg-white text-sea-900 shadow-[var(--shadow-float)] transition active:scale-95"
      >
        <Plus size={24} strokeWidth={STROKE} aria-hidden />
      </button>

      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label={t("common.close")}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-sea-950/45 backdrop-blur-[2px]"
          />
          <div className="absolute inset-x-0 bottom-0 mx-auto max-w-lg rounded-t-[2rem] border-t border-cream-200 bg-cream-50 p-6 pb-safe shadow-[var(--shadow-float)]">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-cream-300" />
            <h2 className="mb-1 font-display text-xl font-light text-ink-900">
              {t("trip.quickAdd.title")}
            </h2>
            <p className="mb-5 text-sm text-ink-500">{t("trip.quickAdd.subtitle")}</p>
            <ul className="mb-4 divide-y divide-cream-200">
              {quickActions.map(({ icon: Icon, label, href, gold }) => (
                <li key={label}>
                  <Link
                    href={href}
                    onClick={() => setOpen(false)}
                    className={`flex w-full items-center gap-4 px-1 py-3.5 text-start transition active:bg-cream-100 ${
                      gold ? "active:scale-[0.99]" : ""
                    }`}
                  >
                    <span
                      className={`flex h-11 w-11 items-center justify-center rounded-full ${
                        gold
                          ? "bg-sea-900 text-lemon-200 ring-1 ring-inset ring-lemon-500/70"
                          : "border border-cream-200 text-sea-700"
                      }`}
                    >
                      <Icon size={20} strokeWidth={STROKE} aria-hidden />
                    </span>
                    <span
                      className={`flex-1 text-lg ${
                        gold ? "font-medium text-ink-900" : "text-ink-900"
                      }`}
                    >
                      {label}
                    </span>
                    <ChevronRight size={18} strokeWidth={STROKE} aria-hidden className="text-ink-300 rtl:rotate-180" />
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
