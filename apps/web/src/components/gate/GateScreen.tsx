import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { GateForm } from "@/app/gate/GateForm";
import { Logo } from "@/components/brand/Logo";
import { TripHeroBackdrop } from "@/components/layout/TripHeroBackdrop";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { TRIPS, type TripKey } from "@together/shared/trips";

/** Shared login screen for the legacy trips, branded per trip. */
export async function GateScreen({ tripKey }: { tripKey: TripKey }) {
  const trip = TRIPS[tripKey];
  const cookieStore = await cookies();
  if (verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value)) {
    redirect(trip.prefix || "/");
  }

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 py-16">
      {/* Backdrop: the trip photo, or the designed hero */}
      <div aria-hidden className="absolute inset-0">
        <TripHeroBackdrop trip={trip} />
      </div>
      <div aria-hidden className="hero-overlay absolute inset-0" />
      <div aria-hidden className="absolute inset-0 bg-sea-950/25" />

      <div className="relative w-full max-w-sm text-center">
        <p className="kicker text-lemon-300">{trip.kicker}</p>
        <h1 className="mt-3 font-display text-5xl font-light text-cream-50">
          {trip.name}
        </h1>
        <p className="mt-3 text-base text-cream-50/80">{trip.tagline}</p>

        <GateForm tripKey={tripKey} />

        <p className="mt-8 text-sm text-cream-50/65">{trip.groupLine}</p>
        <div className="mt-8 flex justify-center text-cream-50/55">
          <Logo size={20} wordClassName="text-[12px]" />
        </div>
      </div>
    </main>
  );
}
