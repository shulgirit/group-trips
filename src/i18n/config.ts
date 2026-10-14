/** Supported UI languages. Adding one = new messages/<locale>/ folder + entry here. */
export const LOCALES = ["he", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "lang";

export const LOCALE_LABEL: Record<Locale, string> = {
  he: "עברית",
  en: "English",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function dirFor(locale: Locale): "rtl" | "ltr" {
  return locale === "he" ? "rtl" : "ltr";
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
