"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Home, Map, MapPin, Menu, Sparkles } from "lucide-react";
import { useTrip } from "@/components/providers/TripProvider";
import { STROKE } from "@/components/ui/Icon";
import { useT } from "@/i18n";

/** Nav labels are one short line: "The Concierge" → "Concierge". */
function shortNavLabel(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length <= 10) return trimmed;
  const words = trimmed.split(/\s+/);
  return words[words.length - 1].length <= 12 ? words[words.length - 1] : trimmed;
}

export function BottomNav() {
  const pathname = usePathname();
  const trip = useTrip();
  const t = useT();

  // First item renders at the inline start (rightmost in RTL). Order per
  // Omer: home · AI (brass hero) · schedule · map · places · more
  const homeHref = trip.prefix || "/";
  const navItems = [
    { href: homeHref, label: t("trip.nav.home"), icon: Home, hero: false },
    { href: `${trip.prefix}/ai`, label: shortNavLabel(trip.ai.navLabel), icon: Sparkles, hero: true },
    { href: `${trip.prefix}/calendar`, label: t("trip.nav.schedule"), icon: CalendarDays, hero: false },
    { href: `${trip.prefix}/map`, label: t("trip.nav.map"), icon: Map, hero: false },
    { href: `${trip.prefix}/places`, label: t("trip.nav.places"), icon: MapPin, hero: false },
    { href: `${trip.prefix}/more`, label: t("trip.nav.more"), icon: Menu, hero: false },
  ] as const;

  return (
    <nav
      aria-label={t("trip.nav.aria")}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 pb-safe lg:inset-y-0 lg:end-auto lg:start-0 lg:w-24 lg:pb-0"
    >
      <div className="pointer-events-auto mx-auto mb-2.5 w-[min(100%-1.5rem,30rem)] rounded-[1.75rem] border border-cream-200 bg-cream-50/90 shadow-[var(--shadow-float)] backdrop-blur-xl lg:m-0 lg:flex lg:h-full lg:w-full lg:items-center lg:rounded-none lg:border-y-0 lg:border-s-0 lg:bg-white/70 lg:shadow-none">
        <ul className="flex items-end justify-between px-1 py-1 lg:w-full lg:flex-col lg:items-stretch lg:justify-center lg:gap-3 lg:px-2">
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
                    className={`flex flex-col items-center gap-0.5 rounded-3xl px-0.5 py-2 text-xs tracking-wide transition ${
                      active ? "font-medium text-sea-900" : "text-ink-700"
                    }`}
                  >
                    <span
                      className={`flex h-8 w-10 items-center justify-center rounded-full bg-sea-900 text-lemon-200 ring-1 ring-inset transition active:scale-95 ${
                        active ? "ring-lemon-400" : "ring-lemon-500/60"
                      }`}
                    >
                      {trip.ai.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element -- small avatar
                        <img src={trip.ai.avatar} alt="" className="h-7 w-7 rounded-full object-cover" />
                      ) : (
                        <Sparkles size={18} strokeWidth={STROKE} aria-hidden />
                      )}
                    </span>
                    <span className="block max-w-full truncate">{label}</span>
                  </Link>
                </li>
              );
            }
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-col items-center gap-0.5 rounded-3xl px-0.5 py-2 text-xs tracking-wide transition ${
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
                  <span className="block max-w-full truncate">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
