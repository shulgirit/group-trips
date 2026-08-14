"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Home, Map, MapPin, Menu } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "עכשיו", icon: Home },
  { href: "/places", label: "מקומות", icon: MapPin },
  { href: "/calendar", label: "לוח", icon: CalendarDays },
  { href: "/map", label: "מפה", icon: Map },
  { href: "/more", label: "עוד", icon: Menu },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="ניווט ראשי"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 pb-safe"
    >
      <div className="pointer-events-auto mx-auto mb-2.5 w-[min(100%-1.5rem,30rem)] rounded-[1.75rem] border border-cream-200/70 bg-cream-50/85 shadow-[var(--shadow-float)] backdrop-blur-xl">
        <ul className="flex items-stretch justify-between px-1.5 py-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-col items-center gap-0.5 rounded-3xl px-1 py-2 text-[11px] transition ${
                    active
                      ? "font-semibold text-sea-700"
                      : "font-medium text-ink-500 active:text-sea-600"
                  }`}
                >
                  <span
                    className={`flex h-8 w-12 items-center justify-center rounded-full transition ${
                      active ? "bg-sea-100" : ""
                    }`}
                  >
                    <Icon size={21} strokeWidth={active ? 2.2 : 1.8} />
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
