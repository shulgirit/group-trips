import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { TRIP } from "@/lib/trip";
import { GateForm } from "./GateForm";

export const metadata: Metadata = {
  title: "כניסה",
};

export default async function GatePage() {
  const cookieStore = await cookies();
  if (verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value)) {
    redirect("/");
  }

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-sea-700 px-6">
      {/* Decorative sun */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-lemon-400/25 blur-3xl"
      />
      {/* Decorative sea glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 right-1/2 h-80 w-[120%] translate-x-1/2 rounded-[100%] bg-sea-500/40 blur-2xl"
      />

      <div className="relative w-full max-w-sm text-center">
        <p className="mb-3 text-5xl" aria-hidden>
          🍋
        </p>
        <h1 className="font-display text-4xl font-bold text-cream-50">
          {TRIP.name}
        </h1>
        <p className="mt-2 text-lg text-sea-200">
          הטיול המשפחתי הפרטי שלנו 🇮🇹
        </p>

        <GateForm />

        <p className="mt-8 text-sm text-sea-200/80">
          ארבע משפחות · שמונה ימים · ים תיכון
        </p>
      </div>
    </main>
  );
}
