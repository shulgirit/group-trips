"use client";

import Link from "next/link";
import { api } from "@together/backend/api";
import { useQuery } from "convex/react";
import { useMemo } from "react";
import { Compass, Lock, type LucideIcon } from "lucide-react";
import { SignInPanel } from "@/components/auth/SignInPanel";
import { TripAppShell } from "@/components/layout/TripAppShell";
import { STROKE } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { useT } from "@/i18n";
import { toTripDoc } from "@/lib/convex-trip";
import { tripConfigFromDoc } from "@together/shared/trip-doc";
import { useAuthUser } from "@/lib/use-auth-user";

function Splash() {
  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 pt-4">
      <Skeleton className="h-[340px] w-full rounded-[2rem]" />
      <Skeleton className="h-24 w-full rounded-3xl" />
      <Skeleton className="h-24 w-full rounded-3xl" />
    </div>
  );
}

function Notice({
  icon: Icon,
  title,
  text,
  children,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-5">
      <div className="card w-full max-w-sm px-6 py-8 text-center">
        <Icon size={28} strokeWidth={STROKE} aria-hidden className="mx-auto text-sea-700" />
        <h1 className="mt-4 font-display text-2xl font-light text-ink-900">
          {title}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">{text}</p>
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}

/**
 * Entry to a trip: resolves the URL reference (Convex id, or the Firestore
 * id of a migrated trip), requires the caller to be a member, then mounts
 * the trip app with a config built from the live trip.
 */
export function TripGate({
  tripId: ref,
  children,
}: {
  tripId: string;
  children: React.ReactNode;
}) {
  const t = useT();
  const { user, loading } = useAuthUser();
  const tripId = useQuery(api.trips.resolve, user ? { ref } : "skip");
  const data = useQuery(api.trips.get, tripId ? { tripId } : "skip");

  // Rebuild only when the trip content changes (aboutUs edits etc.)
  const serialized = data ? JSON.stringify([data.trip, data.avatarUrl]) : "";
  const config = useMemo(
    () => (data && tripId ? tripConfigFromDoc(tripId, toTripDoc(data.trip, data.avatarUrl)) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tripId, serialized]
  );

  if (loading) return <Splash />;

  if (!user) {
    return (
      <Notice
        icon={Lock}
        title={t("product.gate.signInTitle")}
        text={t("product.gate.signInText")}
      >
        <SignInPanel />
      </Notice>
    );
  }

  if (tripId === null) {
    return (
      <Notice icon={Compass} title={t("product.gate.noAccess")} text={t("product.gate.noAccessText")}>
        <Link href="/trips" className="btn-primary w-full py-3">
          {t("product.gate.myTrips")}
        </Link>
      </Notice>
    );
  }

  if (!config || !data) return <Splash />;

  return (
    <TripAppShell config={config} me={data.me} membersCanDeletePlaces={data.trip.membersCanDeletePlaces}>
      {children}
    </TripAppShell>
  );
}
