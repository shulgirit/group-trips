import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";
import { authClient } from "./convex";
import { unregisterDevice } from "./push";

/**
 * Sign-in methods. Apple uses the native sheet on iOS (required by App Store
 * guideline 4.8 next to Google); Google and Apple on Android go through the
 * browser and come back via the together:// scheme. On a guest device a
 * real sign-in moves the guest's trips to the account.
 */

export async function appleNativeAvailable(): Promise<boolean> {
  return Platform.OS === "ios" && (await AppleAuthentication.isAvailableAsync());
}

export async function signInWithApple(): Promise<void> {
  if (Platform.OS !== "ios") return signInWithBrowser("apple");
  const nonce = Crypto.randomUUID();
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
    nonce,
  });
  if (!credential.identityToken) throw new Error("apple_no_token");
  const result = await authClient.signIn.social({ provider: "apple", idToken: { token: credential.identityToken, nonce } });
  if (result.error) throw new Error(result.error.code ?? "apple_failed");
}

export async function signInWithBrowser(provider: "google" | "apple"): Promise<void> {
  const result = await authClient.signIn.social({ provider, callbackURL: "/trips" });
  if (result.error) throw new Error(result.error.code ?? "sign_in_failed");
}

export async function sendEmailCode(email: string): Promise<void> {
  const result = await authClient.emailOtp.sendVerificationOtp({ email: email.trim(), type: "sign-in" });
  if (result.error) throw new Error(result.error.code ?? "send_failed");
}

export async function verifyEmailCode(email: string, otp: string): Promise<void> {
  const result = await authClient.signIn.emailOtp({ email: email.trim(), otp: otp.trim() });
  if (result.error) throw new Error(result.error.code ?? "invalid_code");
}

export async function signInAsGuest(): Promise<void> {
  const result = await authClient.signIn.anonymous();
  if (result.error) throw new Error(result.error.code ?? "guest_failed");
}

export async function signOut(): Promise<void> {
  await unregisterDevice();
  await authClient.signOut();
}

/** "together.app/j/abc123", "https://…/j/abc123" or just the code → the code. */
export function inviteCode(input: string): string | null {
  const match = input.trim().toLowerCase().match(/(?:\/j\/)?([a-z0-9]{6,16})\/?$/);
  return match?.[1] ?? null;
}
