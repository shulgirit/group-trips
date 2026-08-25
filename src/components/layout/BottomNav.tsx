"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Home, Map, MapPin, Menu, Sparkles } from "lucide-react";
import { useTrip } from "@/components/providers/TripProvider";

export function BottomNav() {
  const pathname = usePathname();
  const trip = useTrip();

  // RTL: first item renders rightmost. Order per Omer:
  // עכשיו · המשרת/הטייס (gold hero) · לו״ז · מפה · מקומות · עוד
  const homeHref = trip.prefix || "/";
  const navItems = [
    { href: homeHref, label: "עכשיו", icon: Home, hero: false },
    { href: `${trip.prefix}/ai`, label: trip.ai.navLabel, icon: Sparkles, hero: true },
    { href: `${trip.prefix}/calendar`, label: "לו״ז", icon: CalendarDays, hero: false },
    { href: `${trip.prefix}/map`, label: "מפה", icon: Map, hero: false },
    { href: `${trip.prefix}/places`, label: "מקומות", icon: MapPin, hero: false },
    { href: `${trip.prefix}/more`, label: "עוד", icon: Menu, hero: false },
  ] as const;

  return (
    <nav
      aria-label="ניווט ראשי"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 pb-safe"
    >
      <div className="pointer-events-auto mx-auto mb-2.5 w-[min(100%-1.5rem,30rem)] rounded-[1.75rem] border border-cream-200/70 bg-cream-50/85 shadow-[var(--shadow-float)] backdrop-blur-xl">
        <ul className="flex items-end justify-between px-1 py-1">
          {navItems.map(({ href, label, icon: Icon, hero }) => {
            const active =
              href === homeHref
                ? pathname === homeHref
                : pathname.startsWith(href);
            if (hero) {
              return (
                <li key={href} className="flex-1">
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`flex flex-col items-center gap-0.5 rounded-3xl px-0.5 py-2 text-[10px] transition ${
                      active
                        ? "font-bold text-sea-700"
                        : "font-semibold text-ink-700"
                    }`}
                  >
                    <span
                      className={`flex h-8 w-10 items-center justify-center rounded-full bg-gradient-to-br from-lemon-300 to-lemon-500 text-sea-950 transition active:scale-95 ${
                        active ? "ring-2 ring-sea-700" : ""
                      }`}
                    >
                      <Sparkles size={19} strokeWidth={2.2} />
                    </span>
                    {label}
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
