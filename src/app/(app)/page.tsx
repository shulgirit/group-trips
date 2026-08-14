import Link from "next/link";
import { Countdown } from "@/components/home/Countdown";
import { EmptyState } from "@/components/ui/EmptyState";
import { TRIP } from "@/lib/trip";

export default function HomePage() {
  return (
    <div className="space-y-6">
      {/* Hero + countdown */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-sea-600 to-sea-900 px-6 pb-8 pt-10 text-center shadow-xl shadow-sea-900/20">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 right-8 h-40 w-40 rounded-full bg-lemon-400/30 blur-2xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-sea-400/30 blur-2xl"
        />
        <p className="text-4xl" aria-hidden>
          🇮🇹
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-cream-50">
          {TRIP.heroTitle}
        </h1>
        <div className="mt-6">
          <Countdown targetIso={TRIP.startDate} />
        </div>
      </section>

      {/* Next activity */}
      <section>
        <h2 className="mb-3 font-display text-xl font-bold text-ink-900">
          הפעילות הבאה
        </h2>
        <EmptyState
          emoji="🗓️"
          title="עוד אין פעילויות בלוח"
          description="ברגע שנוסיף מקומות ונשבץ אותם בלוח, הפעילות הבאה תופיע כאן עם שעה, ניווט ומשתתפים."
          action={
            <Link
              href="/places"
              className="inline-block rounded-2xl bg-sea-600 px-5 py-2.5 text-sm font-semibold text-cream-50 transition active:scale-[0.98]"
            >
              למקומות
            </Link>
          }
        />
      </section>

      {/* Saved places teaser */}
      <section>
        <h2 className="mb-3 font-display text-xl font-bold text-ink-900">
          שווה לבדוק
        </h2>
        <EmptyState
          emoji="🍋"
          title="עדיין לא שמרנו מקומות"
          description="בקרוב נוכל להוסיף אטרקציות, מסעדות וחופים — ידנית, מקישור, או ישר מהמלצות ה-AI."
        />
      </section>
    </div>
  );
}
