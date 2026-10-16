"use client";

import Link from "next/link";
import { ChevronRight, Luggage, Plus } from "lucide-react";
import { RouteArt } from "@/components/journal/RouteArt";
import { InviteCodeEntry } from "@/components/onboarding/InviteCodeEntry";
import { SignInPanel } from "@/components/auth/SignInPanel";
import { ProductShell } from "@/components/product/ProductShell";
import { TripCard } from "@/components/product/TripCard";
import { STROKE } from "@/components/ui/Icon";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useT } from "@/i18n";
import { useMyTrips } from "@/lib/my-trips";
import { todayIso } from "@/lib/trip";
import { useAuthUser } from "@/lib/use-auth-user";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { isNative } from "@/lib/native";

export default function MyTripsPage() {
  const t = useT();
  const router = useRouter();
  const { user, personal, loading: authLoading } = useAuthUser();
  const guest = Boolean(user?.isAnonymous);
  const { trips, loading } = useMyTrips(personal || guest ? user!.uid : null);
  const today = todayIso();
  const native = isNative();
  const signedOut = !authLoading && !personal && !guest;
  useEffect(() => {
    if (signedOut && native) router.replace("/welcome");
  }, [signedOut, native, router]);

  if (authLoading) {
    return (
      <ProductShell>
        <ListSkeleton />
      </ProductShell>
    );
  }

  if (!personal && !guest) {
    // The store app opens here: signed-out people get the app onboarding
    if (native) return <main className="min-h-dvh bg-night-950" />;
    return (
      <ProductShell>
        <div className="card mx-auto max-w-sm px-6 py-8 text-center">
          <Luggage size={28} strokeWidth={STROKE} aria-hidden className="mx-auto text-ink-700" />
          <h1 className="mt-4 font-display text-2xl font-medium text-ink-900">
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
  const firstTime = !loading && trips.length === 0;
  const featureId = current.find((trip) => trip.status !== "draft")?.id;

  return (
    <ProductShell wide>
      <div className="space-y-9">
        <header>
          <p className="text-sm text-ink-500">{t("product.trips.title")}</p>
          <h1 className="mt-1.5 font-display text-display-sm font-medium text-ink-900">
            {firstName ? (
              t("product.trips.greeting", { name: firstName })
            ) : (
              t("product.trips.greetingAnon")
            )}
          </h1>
          <p className="mt-2 text-[17px] text-ink-500">{t("product.trips.subtitle")}</p>
        </header>

        {guest && (
          <p className="rounded-2xl border border-chart-200 bg-white px-5 py-4 text-sm leading-relaxed text-ink-700">
            {t("product.trips.guestNote")}
          </p>
        )}

        {loading ? (
          <ListSkeleton />
        ) : firstTime && !guest ? (
          /* First-time user: the whole page is one invitation to start */
          <section className="relative -mx-4 overflow-hidden bg-night-950 text-cream-50 md:mx-0 md:rounded-[1.75rem]">
            <div className="relative h-56 md:h-72">
              <RouteArt seed={user?.uid ?? "first-trip"} />
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-night-950 to-transparent" />
            </div>
            <div className="relative px-6 pb-8 md:px-10 md:pb-10">
              <h2 className="font-display text-[1.75rem] font-medium leading-tight md:text-4xl">
                {t("product.trips.first.title")}
              </h2>
              <p className="mt-3 max-w-md text-[15px] leading-relaxed text-cream-50/75">
                {t("product.trips.first.text")}
              </p>
              <Link
                href="/new"
                className="btn mt-7 w-full rounded-2xl bg-brass-500 py-4 text-base font-semibold text-night-950 md:w-auto md:px-8"
              >
                <Plus size={18} strokeWidth={STROKE} aria-hidden />
                {t("product.trips.first.cta")}
              </Link>
              <InviteCodeEntry className="mt-5 border-t border-cream-50/10 pt-4" />
            </div>
          </section>
        ) : (
          <>
            {!guest && (
              <Link
                href="/new"
                className="flex min-h-[4.5rem] items-center gap-4 rounded-2xl border border-dashed border-cream-300 bg-white/60 px-4 py-3 transition hover:bg-white active:scale-[0.99]"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sea-900 text-cream-50">
                  <Plus size={20} strokeWidth={STROKE} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-ink-900">
                    {t("product.trips.newTrip.title")}
                  </span>
                  <span className="block text-sm text-ink-500">{t("product.trips.newTrip.text")}</span>
                </span>
                <ChevronRight size={18} strokeWidth={STROKE} aria-hidden className="shrink-0 text-ink-400 rtl:rotate-180" />
              </Link>
            )}
            {current.length > 0 && (
              <section className="space-y-3">
                <h2 className="font-display text-2xl font-medium text-ink-900">
                  {t("product.trips.current")}
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {current.map((trip) => (
                    <div key={trip.id} className={trip.id === featureId ? "md:col-span-2" : ""}>
                      <TripCard
                        trip={trip}
                        today={today}
                        variant={trip.id === featureId ? "feature" : "default"}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}
            {past.length > 0 && (
              <section className="space-y-3">
                <h2 className="font-display text-2xl font-medium text-ink-900">
                  {t("product.trips.past")}
                </h2>
                <div className="grid gap-2.5 md:grid-cols-2">
                  {past.map((trip) => (
                    <TripCard key={trip.id} trip={trip} today={today} variant="compact" />
                  ))}
                </div>
              </section>
            )}
            {trips.length === 0 && (
              <div className="rounded-2xl border border-chart-200 bg-white px-6 py-8 text-center">
                <Luggage size={24} strokeWidth={STROKE} aria-hidden className="mx-auto text-ink-400" />
                <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-ink-500">
                  {t("product.trips.empty")}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </ProductShell>
  );
}
