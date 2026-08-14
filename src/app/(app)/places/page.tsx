import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "מקומות" };

const FILTERS = [
  "הכל",
  "אטרקציות",
  "אוכל",
  "חופים",
  "קניות",
  "לא שובץ",
  "שובץ",
  "מועדפים",
] as const;

export default function PlacesPage() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold text-ink-900">מקומות</h1>

      <input
        type="search"
        disabled
        placeholder="חיפוש מקום…"
        className="w-full rounded-2xl border border-cream-200 bg-white px-4 py-3 text-ink-900 outline-none transition placeholder:text-ink-300 focus:border-sea-500 disabled:opacity-60"
        aria-label="חיפוש מקום"
      />

      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex w-max gap-2 pb-1">
          {FILTERS.map((filter, index) => (
            <span
              key={filter}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium ${
                index === 0
                  ? "bg-sea-600 text-cream-50"
                  : "bg-cream-100 text-ink-500"
              }`}
            >
              {filter}
            </span>
          ))}
        </div>
      </div>

      <EmptyState
        emoji="📍"
        title="עוד אין מקומות שמורים"
        description="בשלב הבא נחבר את Firebase ואז נוכל להוסיף כאן אטרקציות, מסעדות, חופים וגלידריות — בקליק אחד."
      />
    </div>
  );
}
