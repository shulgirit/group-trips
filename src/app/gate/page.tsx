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
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6">
      {/* Photographic backdrop */}
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${TRIP.heroImage})` }}
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-sea-950/55 via-sea-950/40 to-sea-950/80"
      />

      <div className="relative w-full max-w-sm text-center">
        <p className="kicker text-lemon-300">Sicily Together</p>
        <h1 className="mt-2 font-display text-5xl font-bold text-cream-50">
          {TRIP.name}
        </h1>
        <p className="mt-2 text-lg text-cream-50/85">
          הטיול המשפחתי הפרטי שלנו 🇮🇹
        </p>

        <GateForm />

        <p className="mt-8 text-sm text-cream-50/70">
          ארבע משפחות · עשרה ימים · ים תיכון
        </p>
      </div>
    </main>
  );
}
