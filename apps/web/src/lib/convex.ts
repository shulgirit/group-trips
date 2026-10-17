"use client";

import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { anonymousClient, emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { ConvexReactClient } from "convex/react";

/** The one Convex client of the web app (realtime queries + mutations). */
export const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/** Better Auth through the same-origin /api/auth proxy (cookies on our domain). */
export const authClient = createAuthClient({
  plugins: [convexClient(), anonymousClient(), emailOTPClient()],
});
