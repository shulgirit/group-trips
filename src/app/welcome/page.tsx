"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Landing } from "@/components/landing/Landing";
import { AppOnboarding } from "@/components/onboarding/AppOnboarding";
import { isNative } from "@/lib/native";
import { useAuthUser } from "@/lib/use-auth-user";

/**
 * Web visitors get the story landing page; the store apps (or ?app=1, to
 * preview it in a browser) get the short app onboarding.
 */
export default function WelcomePage() {
  const router = useRouter();
  const { personal, loading } = useAuthUser();
  const [app, setApp] = useState<boolean | null>(null);

  useEffect(() => {
    const id = setTimeout(
      () => setApp(isNative() || new URLSearchParams(window.location.search).get("app") === "1"),
      0
    );
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!loading && personal) router.replace("/trips");
  }, [loading, personal, router]);

  if (app === null) return <main className="min-h-dvh bg-night-950" />;
  return app ? <AppOnboarding /> : <Landing onSignedIn={() => router.replace("/trips")} />;
}
