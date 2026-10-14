import { DEFAULT_LOCALE, type Locale } from "./config";
import { translate, type TKey, type TVars } from "./translate";

/**
 * Module-global locale for non-React code (db.ts, push-client, formatters
 * called from handlers). Set by LocaleProvider before first paint.
 */
let active: Locale = DEFAULT_LOCALE;

export function setActiveLocale(locale: Locale) {
  active = locale;
}

export function activeLocale(): Locale {
  return active;
}

/** t() for code outside React components. */
export function tActive(key: TKey, vars?: TVars & { count?: number }): string {
  return translate(active, key, vars);
}
