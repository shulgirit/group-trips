"use client";

import Link from "next/link";
import { Luggage, Plus } from "lucide-react";
import { SignInPanel } from "@/components/auth/SignInPanel";
import { ProductShell } from "@/components/product/ProductShell";
import { TripCard } from "@/components/product/TripCard";
import { STROKE } from "@/components/ui/Icon";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useT } from "@/i18n";
import { useMyTrips } from "@/lib/my-trips";
import { todayIso } from "@/lib/trip";
import { useAuthUser } from "@/lib/use-auth-user";

export default function MyTripsPage() {
  const t = useT();
  const { user, personal, loading: authLoading } = useAuthUser();
  const guest = Boolean(user?.isAnonymous);
  const { trips, loading } = useMyTrips(personal || guest ? user!.uid : null);
  const today = todayIso();

  if (authLoading) {
    return (
      <ProductShell>
        <ListSkeleton />
      </ProductShell>
    );
  }

  if (!personal && !guest) {
    return (
      <ProductShell>
        <div className="card mx-auto max-w-sm px-6 py-8 text-center">
          <Luggage size={28} strokeWidth={STROKE} aria-hidden className="mx-auto text-sea-700" />
          <h1 className="mt-4 font-display text-2xl font-light text-ink-900">
            {t("product.trips.title")}
          </h1>
          <p className="mt-2 text-sm text-ink-500">{t("product.trips.signedOutText")}</p>
          <div className="mt-6">
            <SignInPanel />
          </div>
        </div>
      </ProductShell>
    );
  }

  const firstName = (user?.displayName ?? "").split(" ")[0];
  const current = trips.filter((trip) => trip.phase !== "past" || trip.status === "draft");
  const past = trips.filter((trip) => trip.phase === "past" && trip.status !== "draft");

  return (
    <ProductShell>
      <div className="space-y-8">
        <header>
          <p className="kicker text-ink-500">{t("product.trips.title")}</p>
          <h1 className="mt-2 font-display text-3xl font-light text-ink-900">
            {firstName
              ? t("product.trips.greeting", { name: firstName })
              : t("product.trips.greetingAnon")}
          </h1>
          <p className="mt-1 text-ink-500">{t("product.trips.subtitle")}</p>
        </header>

        {guest ? (
          <p className="card px-5 py-4 text-sm leading-relaxed text-ink-500">
            {t("product.trips.guestNote")}
          </p>
        ) : (
          <Link
            href="/new"
            className="card flex items-center gap-4 px-5 py-5 transition active:scale-[0.99]"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sea-700 text-cream-50">
              <Plus size={20} strokeWidth={STROKE} aria-hidden />
            </span>
            <span>
              <span className="block font-display text-lg font-normal text-ink-900">
                {t("product.trips.newTrip.title")}
              </span>
              <span className="block text-sm text-ink-500">{t("product.trips.newTrip.text")}</span>
            </span>
          </Link>
        )}

        {loading ? (
          <ListSkeleton />
        ) : (
          <>
            {current.length > 0 && (
              <section className="space-y-3">
                <h2 className="section-title">{t("product.trips.current")}</h2>
                {current.map((trip) => (
                  <TripCard key={trip.id} trip={trip} today={today} />
                ))}
              </section>
            )}
            {past.length > 0 && (
              <section className="space-y-3">
                <h2 className="section-title">{t("product.trips.past")}</h2>
                {past.map((trip) => (
                  <TripCard key={trip.id} trip={trip} today={today} />
                ))}
              </section>
            )}
            {trips.length === 0 && (
              <p className="text-center text-sm text-ink-500">
                {t("product.trips.empty")}
              </p>
            )}
          </>
        )}
      </div>
    </ProductShell>
  );
}
