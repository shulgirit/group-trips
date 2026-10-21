"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Landing } from "@/components/landing/Landing";
import { AppOnboarding } from "@/components/onboarding/AppOnboarding";
import { useAuthUser } from "@/lib/use-auth-user";

/** Chosen on the server: store app → onboarding, everyone else → the story page. */
export function WelcomeClient({ app }: { app: boolean }) {
  const router = useRouter();
  const { personal, loading } = useAuthUser();

  useEffect(() => {
    if (!loading && personal) router.replace("/trips");
  }, [loading, personal, router]);

  return app ? <AppOnboarding /> : <Landing />;
}
