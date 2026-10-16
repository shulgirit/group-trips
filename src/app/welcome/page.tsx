"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Landing } from "@/components/landing/Landing";
import { useAuthUser } from "@/lib/use-auth-user";

export default function WelcomePage() {
  const router = useRouter();
  const { personal, loading } = useAuthUser();

  useEffect(() => {
    if (!loading && personal) router.replace("/trips");
  }, [loading, personal, router]);

  return <Landing onSignedIn={() => router.replace("/trips")} />;
}
