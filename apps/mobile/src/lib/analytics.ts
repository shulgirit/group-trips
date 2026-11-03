import PostHog from "posthog-react-native";

/**
 * Product analytics (PostHog, US cloud). Only in production builds with a key, never in development.
 * Privacy: people are identified by their account id only (no name or email), no session replay, no screen
 * recordings, and no content (trip names, messages, places) in events — just counts and outcomes.
 */
const key = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const host = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";
const enabled = Boolean(key) && process.env.EXPO_PUBLIC_APP_ENV === "production";

export const posthog: PostHog | null = enabled
  ? new PostHog(key as string, { host, captureAppLifecycleEvents: true, enableSessionReplay: false, flushAt: 10, flushInterval: 20_000 })
  : null;

type Props = Record<string, string | number | boolean | null>;

export function track(event: string, props?: Props) {
  try {
    posthog?.capture(event, props);
  } catch {
    // analytics must never break the app
  }
}

export function screen(name: string) {
  try {
    void posthog?.screen(name);
  } catch {
    // ignore
  }
}

export function identify(userId: string | null) {
  try {
    if (userId) posthog?.identify(userId);
    else posthog?.reset();
  } catch {
    // ignore
  }
}
