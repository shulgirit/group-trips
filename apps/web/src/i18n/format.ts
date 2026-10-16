import type { Locale } from "./config";

/** "Saturday · 15.8" (he: "שבת · 15.8"). */
export function formatDayLabel(dateIso: string, locale: Locale): string {
  const date = new Date(`${dateIso}T12:00:00`);
  const weekday = new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: "long",
  }).format(date);
  return `${weekday} · ${date.getDate()}.${date.getMonth() + 1}`;
}

export function formatShortDate(dateIso: string): string {
  const [, m, d] = dateIso.split("-");
  return `${Number(d)}.${Number(m)}`;
}

// Arabic keeps Latin digits so times and prices read the same across the group
const INTL: Record<Locale, string> = {
  he: "he-IL",
  en: "en-GB",
  ar: "ar-u-nu-latn",
  es: "es-ES",
};

export function intlLocale(locale: Locale): string {
  return INTL[locale];
}

export function formatNumber(value: number, locale: Locale, digits = 0): string {
  return value.toLocaleString(intlLocale(locale), { maximumFractionDigits: digits });
}
