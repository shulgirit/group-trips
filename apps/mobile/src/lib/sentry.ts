import * as Sentry from "@sentry/react-native";

/**
 * Crash and error reports (Sentry). Only in production builds with a DSN. No personal data: no default PII, user
 * identified by account id only, and message/trip content is never attached.
 */
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
export const sentryEnabled = Boolean(dsn) && process.env.EXPO_PUBLIC_APP_ENV === "production";

if (sentryEnabled) {
  Sentry.init({
    dsn,
    environment: process.env.EXPO_PUBLIC_APP_ENV,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    attachScreenshot: false,
    enableNativeCrashHandling: true,
  });
}

export function reportError(error: unknown) {
  if (sentryEnabled) Sentry.captureException(error);
}

export function setSentryUser(id: string | null) {
  if (sentryEnabled) Sentry.setUser(id ? { id } : null);
}

export const wrapRoot = <T extends React.ComponentType<never>>(component: T): T => (sentryEnabled ? (Sentry.wrap(component as never) as unknown as T) : component);
