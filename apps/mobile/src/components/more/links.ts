import { translate } from "@together/i18n/translate";
import type { Locale } from "@together/i18n/config";

/** The public site that serves /j/<code> (opens the app via universal links, else the stores). */
export const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL || "https://together.app").replace(/\/$/, "");

export function inviteUrl(code: string): string {
  return `${SITE_URL}/j/${code}`;
}

/** The invite text in the sender's language (same copy as the web). */
export function inviteMessage(locale: Locale, opts: { tripName: string; familyName?: string | null; url: string }): string {
  const who = opts.familyName ? ` (${opts.familyName})` : "";
  return [
    translate(locale, "product.invite.message.title", { trip: opts.tripName, who }),
    translate(locale, "product.invite.message.body"),
    translate(locale, "product.invite.message.join", { url: opts.url }),
  ].join("\n");
}
