"use client";

import { authClient } from "@/lib/convex";

/** Signs out of this device and lands on the welcome page. */
export async function logoutEverywhere(): Promise<void> {
  await authClient.signOut().catch(() => undefined);
  window.location.replace("/welcome");
}
