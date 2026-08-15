"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Home, Map, MapPin, Menu, Sparkles } from "lucide-react";

// RTL: first item renders rightmost. Order per Omer:
// עכשיו · המשרת (gold hero) · לו״ז · מפה · מקומות · עוד
const NAV_ITEMS = [
  { href: "/", label: "עכשיו", icon: Home, hero: false },
  { href: "/ai", label: "המשרת", icon: Sparkles, hero: true },
  { href: "/calendar", label: "לו״ז", icon: CalendarDays, hero: false },
  { href: "/map", label: "מפה", icon: Map, hero: false },
  { href: "/places", label: "מקומות", icon: MapPin, hero: false },
  { href: "/more", label: "עוד", icon: Menu, hero: false },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="ניווט ראשי"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 pb-safe"
    >
      <div className="pointer-events-auto mx-auto mb-2.5 w-[min(100%-1.5rem,30rem)] rounded-[1.75rem] border border-cream-200/70 bg-cream-50/85 shadow-[var(--shadow-float)] backdrop-blur-xl">
        <ul className="flex items-end justify-between px-1 py-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon, hero }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            if (hero) {
              return (
                <li key={href} className="flex-1">
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className="-mt-5 flex flex-col items-center gap-0.5 px-0.5 pb-1.5"
                  >
                    <span
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-lemon-300 to-lemon-500 text-sea-950 shadow-[var(--shadow-float)] transition active:scale-95 ${
                        active ? "ring-2 ring-sea-700 ring-offset-2 ring-offset-cream-50" : ""
                      }`}
                    >
                      <Sparkles size={24} strokeWidth={2.2} />
                    </span>
                    <span
                      className={`text-[10px] ${
                        active
                          ? "font-bold text-sea-700"
                          : "font-semibold text-ink-700"
                      }`}
                    >
                      {label}
                    </span>
                  </Link>
                </li>
              );
            }
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-col items-center gap-0.5 rounded-3xl px-0.5 py-2 text-[10px] transition ${
                    active
                      ? "font-semibold text-sea-700"
                      : "font-medium text-ink-500 active:text-sea-600"
                  }`}
                >
                  <span
                    className={`flex h-8 w-10 items-center justify-center rounded-full transition ${
                      active ? "bg-sea-100" : ""
                    }`}
                  >
                    <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
                  </span>
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
