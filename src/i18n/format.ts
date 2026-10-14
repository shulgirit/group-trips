import type { Locale } from "./config";

/** "Saturday · 15.8" (he: "שבת · 15.8"). */
export function formatDayLabel(dateIso: string, locale: Locale): string {
  const date = new Date(`${dateIso}T12:00:00`);
  const weekday = new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-GB", {
    weekday: "long",
  }).format(date);
  return `${weekday} · ${date.getDate()}.${date.getMonth() + 1}`;
}

export function formatShortDate(dateIso: string): string {
  const [, m, d] = dateIso.split("-");
  return `${Number(d)}.${Number(m)}`;
}

export function intlLocale(locale: Locale): string {
  return locale === "he" ? "he-IL" : "en-GB";
}

export function formatNumber(value: number, locale: Locale, digits = 0): string {
  return value.toLocaleString(intlLocale(locale), { maximumFractionDigits: digits });
}
