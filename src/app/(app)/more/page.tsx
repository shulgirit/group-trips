"use client";

import Link from "next/link";
import { LogoutRow } from "@/components/tour/LogoutRow";
import { TourRow } from "@/components/tour/TourRow";
import { useTrip } from "@/components/providers/TripProvider";

export default function MorePage() {
  const trip = useTrip();
  const aiHref = `${trip.prefix}/ai`;

  const sections = [
    {
      emoji: trip.ai.moreEmoji,
      label: trip.ai.moreLabel,
      description: "ה-AI הפרטי שלנו — מכיר את כל הטיול",
      href: aiHref,
    },
    {
      emoji: "🗳️",
      label: "סקרים",
      description: "מחליטים ביחד",
      href: `${trip.prefix}/polls`,
    },
    {
      emoji: "💶",
      label: "הוצאות",
      description: "מי שילם ומי חייב",
      href: `${trip.prefix}/expenses`,
    },
    {
      emoji: trip.key === "sicily" ? "👨‍👩‍👧‍👦" : "👨‍✈️",
      label: trip.group.moreLabel,
      description: trip.group.moreDescription,
      href: `${trip.prefix}/families`,
    },
    {
      emoji: "🎟️",
      label: "הזמנות ומסמכים",
      description: "כרטיסים, אישורים ואזור אישי",
      href: `${trip.prefix}/documents`,
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
      description: "החשבון שלי, הזהות שלי ופרטי הטיול",
      href: `${trip.prefix}/settings`,
    },
  ] as const;

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold text-ink-900">עוד</h1>
      <ul className="space-y-2">
        {sections.map(({ emoji, label, description, href }) => (
          <li key={label}>
            {href ? (
              <Link
                href={href}
                className={`flex items-center gap-4 rounded-3xl border px-4 py-4 transition active:scale-[0.99] ${
                  href === aiHref
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
        <li>
          <LogoutRow />
        </li>
      </ul>
    </div>
  );
}
