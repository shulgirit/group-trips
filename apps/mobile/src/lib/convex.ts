import { expoClient } from "@better-auth/expo/client";
import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { anonymousClient, emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { ConvexReactClient } from "convex/react";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;
const siteUrl = process.env.EXPO_PUBLIC_CONVEX_SITE_URL;
if (!convexUrl || !siteUrl) throw new Error("Set EXPO_PUBLIC_CONVEX_URL and EXPO_PUBLIC_CONVEX_SITE_URL (apps/mobile/.env)");

export const convex = new ConvexReactClient(convexUrl, { unsavedChangesWarning: false });

const scheme = (Constants.expoConfig?.scheme as string | undefined) ?? "together";

/** Better Auth straight against Convex; the session lives in the secure store. */
export const authClient = createAuthClient({
  baseURL: siteUrl,
  plugins: [
    expoClient({ scheme, storagePrefix: scheme, storage: SecureStore }),
    convexClient(),
    anonymousClient(),
    emailOTPClient(),
  ],
});
