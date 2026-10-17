"use client";

import { authClient } from "@/lib/convex";

/**
 * Sign-in methods (Better Auth). Social sign-in redirects through the
 * provider and comes back to `returnTo`; on a guest device it links the
 * guest's trips to the account (anonymous plugin onLinkAccount).
 */

export type SocialProvider = "google" | "apple";

export function appleSignInAvailable(): boolean {
  return process.env.NEXT_PUBLIC_APPLE_SIGN_IN === "1";
}

export async function signInWithProvider(provider: SocialProvider, returnTo?: string): Promise<void> {
  const callbackURL = returnTo ?? (typeof window !== "undefined" ? window.location.pathname + window.location.search : "/trips");
  const result = await authClient.signIn.social({ provider, callbackURL });
  if (result.error) throw new Error(result.error.code ?? "sign_in_failed");
}

/** Step 1 of email sign-in: a 6-digit code to the inbox. */
export async function sendEmailCode(email: string): Promise<void> {
  const result = await authClient.emailOtp.sendVerificationOtp({ email: email.trim(), type: "sign-in" });
  if (result.error) throw new Error(result.error.code ?? "send_failed");
}

/** Step 2: the code signs in (creating the account on first use). */
export async function verifyEmailCode(email: string, otp: string): Promise<void> {
  const result = await authClient.signIn.emailOtp({ email: email.trim(), otp: otp.trim() });
  if (result.error) throw new Error(result.error.code ?? "invalid_code");
}

/** A guest identity on this device (kid devices / joining without an account). */
export async function signInAsGuest(): Promise<void> {
  const result = await authClient.signIn.anonymous();
  if (result.error) throw new Error(result.error.code ?? "guest_failed");
}
