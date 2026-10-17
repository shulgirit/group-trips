import AsyncStorage from "@react-native-async-storage/async-storage";
import { setActiveLocale } from "@together/i18n/active";
import { DEFAULT_LOCALE, dirFor, isLocale, type Locale } from "@together/i18n/config";
import { type TKey, type TVars, translate } from "@together/i18n/translate";
import { getLocales } from "expo-localization";
import * as Updates from "expo-updates";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DevSettings, I18nManager } from "react-native";

/**
 * The app's language: a saved choice, else the device language (he/en/ar/es),
 * else English. Hebrew and Arabic flip the whole layout; React Native only
 * applies that after a reload, which happens once when it changes.
 */

const KEY = "together.locale";

function deviceLocale(): Locale {
  for (const entry of getLocales()) {
    const code = entry.languageCode === "iw" ? "he" : entry.languageCode;
    if (isLocale(code)) return code;
  }
  return DEFAULT_LOCALE;
}

const RELOAD_KEY = "together.directionReload";

async function applyDirection(locale: Locale) {
  const rtl = dirFor(locale) === "rtl";
  const want = rtl ? "rtl" : "ltr";
  if (I18nManager.isRTL === rtl) {
    await AsyncStorage.removeItem(RELOAD_KEY).catch(() => undefined);
    return;
  }
  I18nManager.allowRTL(rtl);
  I18nManager.forceRTL(rtl);
  // Layout direction is read at startup, so reload — but only once per
  // change: if the host refuses the direction, don't loop.
  const tried = await AsyncStorage.getItem(RELOAD_KEY).catch(() => null);
  if (tried === want) return;
  await AsyncStorage.setItem(RELOAD_KEY, want).catch(() => undefined);
  try {
    await Updates.reloadAsync();
  } catch {
    DevSettings.reload();
  }
}

interface LocaleState {
  locale: Locale;
  rtl: boolean;
  setLocale: (locale: Locale) => Promise<void>;
}

const LocaleContext = createContext<LocaleState | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setState] = useState<Locale | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((saved) => (isLocale(saved) ? saved : deviceLocale()))
      .catch(() => deviceLocale())
      .then((initial) => {
        setActiveLocale(initial);
        setState(initial);
        void applyDirection(initial);
      });
  }, []);

  const setLocale = useCallback(async (next: Locale) => {
    await AsyncStorage.setItem(KEY, next).catch(() => undefined);
    setActiveLocale(next);
    setState(next);
    await applyDirection(next);
  }, []);

  const value = useMemo(() => (locale ? { locale, rtl: dirFor(locale) === "rtl", setLocale } : null), [locale, setLocale]);
  if (!value) return null;
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleState {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("useLocale outside LocaleProvider");
  return value;
}

export function useT() {
  const { locale } = useLocale();
  return useCallback((key: TKey, vars?: TVars & { count?: number }) => translate(locale, key, vars), [locale]);
}

export type { TKey };
