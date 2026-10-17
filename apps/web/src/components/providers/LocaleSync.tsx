"use client";

import { api } from "@together/backend/api";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useEffect } from "react";
import { useLocale } from "@/i18n";

/** Keeps the account's language in sync with the UI (server pushes and AI texts follow it). */
export function LocaleSync() {
  const { locale } = useLocale();
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.account.me, isAuthenticated ? {} : "skip");
  const setLocale = useMutation(api.account.setLocale);
  useEffect(() => {
    if (me && me.locale !== locale) setLocale({ locale }).catch(() => undefined);
  }, [me, locale, setLocale]);
  return null;
}
