"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { SignInPanel } from "@/components/auth/SignInPanel";
import { BRAND } from "@/lib/brand";
import { useAuthUser } from "@/lib/use-auth-user";

const FEATURES = [
  {
    emoji: "✨",
    title: "עוזר AI אישי לחבורה",
    text: "אתם בוחרים לו שם ואופי. הוא ממליץ על מקומות, משבץ בלו״ז ופותח סקרים",
  },
  {
    emoji: "🎟️",
    title: "מעלים כרטיסים והזמנות",
    text: "טיסות, מלון ואטרקציות נכנסים ללו״ז ולמפה לבד",
  },
  {
    emoji: "📍",
    title: "מפה, לו״ז וניווט",
    text: "רואים איפה אתם, מה הבא ונוסעים בלחיצה עם Waze",
  },
  {
    emoji: "💶",
    title: "הוצאות וסקרים",
    text: "מי שילם, מי חייב, ומחליטים יחד בלי ויכוחים",
  },
];

export default function WelcomePage() {
  const router = useRouter();
  const { personal, loading } = useAuthUser();

  useEffect(() => {
    if (!loading && personal) router.replace("/trips");
  }, [loading, personal, router]);

  return (
    <main className="min-h-dvh">
      <section className="relative overflow-hidden bg-gradient-to-br from-sea-950 via-sea-800 to-sea-600 px-6 pb-14 pt-[max(3.5rem,env(safe-area-inset-top))] text-center">
        <div aria-hidden className="absolute -left-20 top-0 h-72 w-72 rounded-full bg-lemon-400/20 blur-3xl" />
        <div aria-hidden className="absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-sea-400/25 blur-3xl" />
        <div className="relative mx-auto max-w-md">
          <span
            aria-hidden
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-cream-50/10 text-4xl ring-1 ring-cream-50/20"
          >
            {BRAND.emoji}
          </span>
          <p className="kicker mt-5 text-lemon-300">{BRAND.name}</p>
          <h1 className="mt-2 font-display text-4xl font-bold leading-tight text-cream-50">
            {BRAND.tagline}
          </h1>
          <p className="mt-3 text-base leading-relaxed text-cream-50/80">
            בונים טיול בכמה דקות, מזמינים את החבורה בוואטסאפ, וכל מה שצריך —
            לו״ז, מפה, הוצאות ועוזר AI — מחכה לכולם באפליקציה אחת.
          </p>
          <div className="mx-auto mt-8 max-w-xs">
            <SignInPanel tone="dark" onSignedIn={() => router.replace("/trips")} />
          </div>
          <p className="mt-4 text-xs text-cream-50/60">
            בהתחברות אתם מסכימים ל
            <Link href="/terms" className="underline">
              תנאי השימוש
            </Link>{" "}
            ול
            <Link href="/privacy" className="underline">
              מדיניות הפרטיות
            </Link>
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-lg px-5 py-10">
        <ul className="grid gap-3 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <li key={feature.title} className="card px-5 py-4">
              <p className="text-2xl" aria-hidden>
                {feature.emoji}
              </p>
              <p className="mt-2 font-display text-lg font-bold text-ink-900">
                {feature.title}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-ink-500">
                {feature.text}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-10 text-center text-sm text-ink-500">
          מטיילים עם סיציליה 2026 או סרדיניה?{" "}
          <Link href="/gate" className="font-semibold text-sea-700 underline">
            כניסה עם קוד הטיול
          </Link>
        </p>
      </section>
    </main>
  );
}
