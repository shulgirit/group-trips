/** Supported UI languages. Adding one = new messages/<locale>/ folder + entry here. */
export const LOCALES = ["he", "en", "ar", "es"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "lang";

export const LOCALE_LABEL: Record<Locale, string> = {
  he: "עברית",
  en: "English",
  ar: "العربية",
  es: "Español",
};

/** Locales whose full message files exist; the others fall back to English. */
export const COMPLETE_LOCALES = ["he", "en"] as const;
export type CompleteLocale = (typeof COMPLETE_LOCALES)[number];

/** For server-generated content that exists only in he/en (place summaries, notices). */
export function contentLocale(locale: Locale): CompleteLocale {
  return locale === "he" ? "he" : "en";
}

const RTL: readonly Locale[] = ["he", "ar"];

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function dirFor(locale: Locale): "rtl" | "ltr" {
  return RTL.includes(locale) ? "rtl" : "ltr";
}

/** Explicit cookie wins; otherwise the first supported Accept-Language entry. */
export function resolveLocale(
  cookieValue: string | undefined | null,
  acceptLanguage: string | undefined | null
): Locale {
  if (isLocale(cookieValue)) return cookieValue;
  for (const part of (acceptLanguage ?? "").split(",")) {
    const tag = part.split(";")[0].trim().toLowerCase();
    const base = tag.split("-")[0];
    if (base === "he" || base === "iw") return "he";
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}
