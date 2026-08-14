import type { Metadata } from "next";
import Link from "next/link";
import { TourRow } from "@/components/tour/TourRow";

export const metadata: Metadata = { title: "עוד" };

const SECTIONS = [
  {
    emoji: "🦻",
    label: "המשרת של חבורת מיחא",
    description: "ה-AI הפרטי שלנו — מכיר את כל הטיול",
    href: "/ai",
  },
  {
    emoji: "🗳️",
    label: "סקרים",
    description: "מחליטים ביחד",
    href: "/polls",
  },
  {
    emoji: "💶",
    label: "הוצאות",
    description: "מי שילם ומי חייב",
    href: "/expenses",
  },
  {
    emoji: "👨‍👩‍👧‍👦",
    label: "משפחות",
    description: "ארבע המשפחות שלנו",
    href: "/families",
  },
  {
    emoji: "🎟️",
    label: "הזמנות ומסמכים",
    description: "כרטיסים, אישורים ואזור אישי",
    href: "/documents",
  },
  {
    emoji: "📸",
    label: "תמונות",
    description: "הגלריה של הטיול",
    href: null,
  },
  {
    emoji: "⚙️",
    label: "הגדרות",
    description: "החשבון שלי, זהות משפחתית ופרטי הטיול",
    href: "/settings",
  },
] as const;

export default function MorePage() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold text-ink-900">עוד</h1>
      <ul className="space-y-2">
        {SECTIONS.map(({ emoji, label, description, href }) => (
          <li key={label}>
            {href ? (
              <Link
                href={href}
                className={`flex items-center gap-4 rounded-3xl border px-4 py-4 transition active:scale-[0.99] ${
                  href === "/ai"
                    ? "border-lemon-300 bg-gradient-to-l from-lemon-300/70 via-lemon-100 to-lemon-100 shadow-sm"
                    : "border-cream-200 bg-white active:bg-cream-100"
                }`}
              >
                <span className="text-2xl" aria-hidden>
                  {emoji}
                </span>
                <span className="flex-1">
                  <span className="block font-semibold text-ink-900">
                    {label}
                  </span>
                  <span className="block text-sm text-ink-500">
                    {description}
                  </span>
                </span>
                <span aria-hidden className="text-ink-300">
                  ‹
                </span>
              </Link>
            ) : (
              <div className="flex items-center gap-4 rounded-3xl border border-cream-200 bg-white px-4 py-4 opacity-70">
                <span className="text-2xl" aria-hidden>
                  {emoji}
                </span>
                <span className="flex-1">
                  <span className="block font-semibold text-ink-900">
                    {label}
                  </span>
                  <span className="block text-sm text-ink-500">
                    {description}
                  </span>
                </span>
                <span className="rounded-full bg-lemon-100 px-2.5 py-1 text-xs font-medium text-ink-700">
                  בקרוב
                </span>
              </div>
            )}
          </li>
        ))}
        <li>
          <TourRow />
        </li>
      </ul>
    </div>
  );
}
