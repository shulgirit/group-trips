"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { Compass, Lock, type LucideIcon } from "lucide-react";
import { SignInPanel } from "@/components/auth/SignInPanel";
import { TripAppShell } from "@/components/layout/TripAppShell";
import { STROKE } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { useT } from "@/i18n";
import { db } from "@/lib/firebase/client";
import { tripConfigFromDoc, type TripDoc } from "@/lib/trip-doc";
import { useAuthUser } from "@/lib/use-auth-user";

type State =
  | { kind: "loading" }
  | { kind: "denied" }
  | { kind: "missing" }
  | { kind: "ready"; data: TripDoc };

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
 * Entry to a self-serve trip: requires a signed-in identity that the
 * Firestore rules accept as a member, then mounts the regular trip app
 * with a config built from the live trip doc.
 */
export function TripGate({
  tripId,
  children,
}: {
  tripId: string;
  children: React.ReactNode;
}) {
  const t = useT();
  const { user, loading } = useAuthUser();
  const [state, setState] = useState<State>({ kind: "loading" });
  const uid = user?.uid ?? null;

  useEffect(() => {
    if (!uid) return;
    setState({ kind: "loading" });
    return onSnapshot(
      doc(db(), `trips/${tripId}`),
      (snapshot) => {
        const data = snapshot.data() as TripDoc | undefined;
        setState(
          data?.destination ? { kind: "ready", data } : { kind: "missing" }
        );
      },
      () => setState({ kind: "denied" })
    );
  }, [tripId, uid]);

  const data = state.kind === "ready" ? state.data : null;
  // Rebuild only when the doc content changes (aboutUs edits etc.)
  const serialized = data ? JSON.stringify(data) : "";
  const config = useMemo(
    () => (data ? tripConfigFromDoc(tripId, data) : null),
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

  if (state.kind === "denied" || state.kind === "missing") {
    return (
      <Notice
        icon={Compass}
        title={state.kind === "missing" ? t("product.gate.notFound") : t("product.gate.noAccess")}
        text={t("product.gate.noAccessText")}
      >
        <Link href="/trips" className="btn-primary w-full py-3">
          {t("product.gate.myTrips")}
        </Link>
      </Notice>
    );
  }

  if (!config) return <Splash />;

  return <TripAppShell config={config}>{children}</TripAppShell>;
}
