"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { SignInPanel } from "@/components/auth/SignInPanel";
import { ProductShell } from "@/components/product/ProductShell";
import { TripCard } from "@/components/product/TripCard";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useMyTrips } from "@/lib/my-trips";
import { todayIso } from "@/lib/trip";
import { useAuthUser } from "@/lib/use-auth-user";

export default function MyTripsPage() {
  const { user, personal, loading: authLoading } = useAuthUser();
  const { trips, loading } = useMyTrips(personal ? user!.uid : null);
  const today = todayIso();

  if (authLoading) {
    return (
      <ProductShell>
        <ListSkeleton />
      </ProductShell>
    );
  }

  if (!personal) {
    return (
      <ProductShell>
        <div className="card mx-auto max-w-sm px-6 py-8 text-center">
          <p className="text-4xl" aria-hidden>
            🧳
          </p>
          <h1 className="mt-3 font-display text-2xl font-bold text-ink-900">
            הטיולים שלי
          </h1>
          <p className="mt-2 text-sm text-ink-500">
            התחברו כדי לראות את הטיולים שלכם ולפתוח טיול חדש
          </p>
          <div className="mt-6">
            <SignInPanel />
          </div>
        </div>
      </ProductShell>
    );
  }

  const firstName = (user?.displayName ?? "").split(" ")[0];
  const current = trips.filter((t) => t.phase !== "past" || t.status === "draft");
  const past = trips.filter((t) => t.phase === "past" && t.status !== "draft");

  return (
    <ProductShell>
      <div className="space-y-8">
        <header>
          <p className="kicker text-terra-500">הטיולים שלי</p>
          <h1 className="mt-1 font-display text-3xl font-bold text-ink-900">
            {firstName ? `היי ${firstName} 👋` : "היי 👋"}
          </h1>
          <p className="mt-1 text-ink-500">לאן נוסעים הפעם?</p>
        </header>

        <Link
          href="/new"
          className="card flex items-center gap-4 border-dashed border-sea-200 bg-sea-100/40 px-5 py-5 transition active:scale-[0.99]"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sea-700 text-cream-50">
            <Plus className="h-6 w-6" />
          </span>
          <span>
            <span className="block font-display text-lg font-bold text-ink-900">
              טיול חדש
            </span>
            <span className="block text-sm text-ink-500">
              יעד, חבורה, הזמנות ועוזר AI — בכמה דקות
            </span>
          </span>
        </Link>

        {loading ? (
          <ListSkeleton />
        ) : (
          <>
            {current.length > 0 && (
              <section className="space-y-3">
                <h2 className="section-title">בקרוב ועכשיו</h2>
                {current.map((trip) => (
                  <TripCard key={trip.id} trip={trip} today={today} />
                ))}
              </section>
            )}
            {past.length > 0 && (
              <section className="space-y-3">
                <h2 className="section-title">טיולים קודמים</h2>
                {past.map((trip) => (
                  <TripCard key={trip.id} trip={trip} today={today} />
                ))}
              </section>
            )}
            {trips.length === 0 && (
              <p className="text-center text-sm text-ink-500">
                עוד אין טיולים. קיבלתם הזמנה? פתחו את הקישור מהוואטסאפ 📩
              </p>
            )}
          </>
        )}
      </div>
    </ProductShell>
  );
}
