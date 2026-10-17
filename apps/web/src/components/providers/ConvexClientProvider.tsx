"use client";

import { type AuthClient, ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { authClient, convex } from "@/lib/convex";

// The provider's type only models the convex client plugin; ours also carries
// the anonymous and email-OTP plugins (a superset at runtime), hence the cast.
const providerClient = authClient as unknown as AuthClient;

export function ConvexClientProvider({
  children,
  initialToken,
}: {
  children: React.ReactNode;
  initialToken?: string | null;
}) {
  return (
    <ConvexBetterAuthProvider client={convex} authClient={providerClient} initialToken={initialToken}>
      {children}
    </ConvexBetterAuthProvider>
  );
}
