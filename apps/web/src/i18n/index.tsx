"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import { setActiveLocale } from "@together/i18n/active";
import { LOCALE_COOKIE, dirFor, type Locale } from "@together/i18n/config";
import { formatDayLabel } from "@together/i18n/format";
import { translate, type TKey, type TVars } from "@together/i18n/translate";

interface LocaleState {
  locale: Locale;
  dir: "rtl" | "ltr";
}

const LocaleContext = createContext<LocaleState>({ locale: "en", dir: "ltr" });

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  // Set during render so non-React helpers agree before first paint
  setActiveLocale(locale);
  const value = useMemo(() => ({ locale, dir: dirFor(locale) }), [locale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}

/** const t = useT(); t("trip.nav.home") · t("money.people", { count: 3 }) */
export function useT() {
  const { locale } = useContext(LocaleContext);
  return useCallback(
    (key: TKey, vars?: TVars & { count?: number }) => translate(locale, key, vars),
    [locale]
  );
}

/** Day label in the active language ("Saturday · 15.8"). */
export function useDayLabel() {
  const { locale } = useContext(LocaleContext);
  return useCallback((dateIso: string) => formatDayLabel(dateIso, locale), [locale]);
}

/** Persists the choice and reloads so server-rendered parts follow. */
export function setLocalePreference(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  window.location.reload();
}

export type { Locale, TKey };
