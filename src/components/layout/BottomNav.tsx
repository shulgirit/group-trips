"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "עכשיו", icon: HomeIcon },
  { href: "/places", label: "מקומות", icon: PinIcon },
  { href: "/calendar", label: "לוח", icon: CalendarIcon },
  { href: "/map", label: "מפה", icon: MapIcon },
  { href: "/more", label: "עוד", icon: MenuIcon },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="ניווט ראשי"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-cream-200 bg-cream-50/90 backdrop-blur-lg pb-safe"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-between px-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 rounded-2xl px-1 pb-2 pt-2.5 text-[11px] font-medium transition ${
                  active ? "text-sea-700" : "text-ink-500 active:text-sea-600"
                }`}
              >
                <span
                  className={`flex h-8 w-14 items-center justify-center rounded-full transition ${
                    active ? "bg-sea-100" : ""
                  }`}
                >
                  <Icon />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

const iconProps = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function HomeIcon() {
  return (
    <svg {...iconProps} aria-hidden>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg {...iconProps} aria-hidden>
      <path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg {...iconProps} aria-hidden>
      <rect x="3.5" y="5" width="17" height="16" rx="3" />
      <path d="M8 3v4M16 3v4M3.5 10.5h17" />
    </svg>
  );
}

function MapIcon() {
  return (
    <svg {...iconProps} aria-hidden>
      <path d="m9 4-5 2v14l5-2 6 2 5-2V4l-5 2-6-2Z" />
      <path d="M9 4v14M15 6v14" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg {...iconProps} aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}
