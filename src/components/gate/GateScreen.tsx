import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { GateForm } from "@/app/gate/GateForm";
import { TripHeroBackdrop } from "@/components/layout/TripHeroBackdrop";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { TRIPS, type TripKey } from "@/lib/trips";

/** Shared login screen, branded per trip. */
export async function GateScreen({ tripKey }: { tripKey: TripKey }) {
  const trip = TRIPS[tripKey];
  const cookieStore = await cookies();
  if (verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value)) {
    redirect(trip.prefix || "/");
  }

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6">
      {/* Backdrop: trip photo, or the designed gradient hero */}
      <div aria-hidden className="absolute inset-0">
        <TripHeroBackdrop trip={trip} />
      </div>
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-sea-950/55 via-sea-950/40 to-sea-950/80"
      />

      <div className="relative w-full max-w-sm text-center">
        <p className="kicker text-lemon-300">{trip.kicker}</p>
        <h1 className="mt-2 font-display text-5xl font-bold text-cream-50">
          {trip.name}
        </h1>
        <p className="mt-2 text-lg text-cream-50/85">{trip.tagline}</p>

        <GateForm tripKey={tripKey} />

        <p className="mt-8 text-sm text-cream-50/70">{trip.groupLine}</p>
      </div>
    </main>
  );
}
