import type { Metadata } from "next";

export const metadata: Metadata = { title: "עוד" };

const SECTIONS = [
  { emoji: "✨", label: "AI", description: "הקונסיירז׳ הפרטי של הטיול" },
  { emoji: "🗳️", label: "סקרים", description: "מחליטים ביחד" },
  { emoji: "💶", label: "הוצאות", description: "מי שילם ומי חייב" },
  { emoji: "🎟️", label: "הזמנות ומסמכים", description: "כרטיסים ואישורים" },
  { emoji: "👨‍👩‍👧‍👦", label: "משפחות", description: "ארבע המשפחות שלנו" },
  { emoji: "📸", label: "תמונות", description: "הגלריה של הטיול" },
  { emoji: "⚙️", label: "הגדרות", description: "תאריכים, וילה ותמונות" },
] as const;

export default function MorePage() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold text-ink-900">עוד</h1>
      <ul className="space-y-2">
        {SECTIONS.map(({ emoji, label, description }) => (
          <li
            key={label}
            className="flex items-center gap-4 rounded-3xl border border-cream-200 bg-white px-4 py-4"
          >
            <span className="text-2xl" aria-hidden>
              {emoji}
            </span>
            <div className="flex-1">
              <div className="font-semibold text-ink-900">{label}</div>
              <div className="text-sm text-ink-500">{description}</div>
            </div>
            <span className="rounded-full bg-lemon-100 px-2.5 py-1 text-xs font-medium text-ink-700">
              בקרוב
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
