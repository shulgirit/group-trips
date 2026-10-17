import { query } from "./_generated/server";

/**
 * Which social sign-in providers this deployment has credentials for. The app
 * hides a button until its provider is configured (e.g. Apple while the
 * Developer account is pending). Booleans only — nothing secret.
 */
export const available = query({
  args: {},
  handler: async () => ({
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    apple: Boolean(process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET),
  }),
});
