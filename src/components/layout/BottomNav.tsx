"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Home, Map, MapPin, Menu, Sparkles } from "lucide-react";
import { useTrip } from "@/components/providers/TripProvider";
import { STROKE } from "@/components/ui/Icon";
import { useT } from "@/i18n";

export function BottomNav() {
  const pathname = usePathname();
  const trip = useTrip();
  const t = useT();

  // First item renders at the inline start (rightmost in RTL). Order per
  // Omer: home · AI (brass hero) · schedule · map · places · more
  const homeHref = trip.prefix || "/";
  const navItems = [
    { href: homeHref, label: t("trip.nav.home"), icon: Home, hero: false },
    { href: `${trip.prefix}/ai`, label: trip.ai.navLabel, icon: Sparkles, hero: true },
    { href: `${trip.prefix}/calendar`, label: t("trip.nav.schedule"), icon: CalendarDays, hero: false },
    { href: `${trip.prefix}/map`, label: t("trip.nav.map"), icon: Map, hero: false },
    { href: `${trip.prefix}/places`, label: t("trip.nav.places"), icon: MapPin, hero: false },
    { href: `${trip.prefix}/more`, label: t("trip.nav.more"), icon: Menu, hero: false },
  ] as const;

  return (
    <nav
      aria-label={t("trip.nav.aria")}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 pb-safe"
    >
      <div className="pointer-events-auto mx-auto mb-2.5 w-[min(100%-1.5rem,30rem)] rounded-[1.75rem] border border-cream-200 bg-cream-50/90 shadow-[var(--shadow-float)] backdrop-blur-xl">
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
                    className={`flex flex-col items-center gap-0.5 rounded-3xl px-0.5 py-2 text-[10px] tracking-wide transition ${
                      active ? "font-medium text-sea-900" : "text-ink-700"
                    }`}
                  >
                    <span
                      className={`flex h-8 w-10 items-center justify-center rounded-full bg-sea-900 text-lemon-200 ring-1 ring-inset transition active:scale-95 ${
                        active ? "ring-lemon-400" : "ring-lemon-500/60"
                      }`}
                    >
                      <Sparkles size={18} strokeWidth={STROKE} aria-hidden />
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
                  className={`flex flex-col items-center gap-0.5 rounded-3xl px-0.5 py-2 text-[10px] tracking-wide transition ${
                    active
                      ? "font-medium text-sea-900"
                      : "text-ink-500 active:text-sea-700"
                  }`}
                >
                  <span
                    className={`flex h-8 w-10 items-center justify-center rounded-full transition ${
                      active ? "bg-cream-100" : ""
                    }`}
                  >
                    <Icon size={20} strokeWidth={active ? 1.75 : STROKE} aria-hidden />
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
