"use client";

import { Globe2 } from "lucide-react";
import { setLocalePreference, useLocale } from "@/i18n";
import { LOCALES, LOCALE_LABEL, type Locale } from "@together/i18n/config";
import { STROKE } from "@/components/ui/Icon";

/** Compact language picker for the landing header (native select = accessible everywhere). */
export function LanguageMenu() {
  const { locale } = useLocale();
  return (
    <label className="relative inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-cream-50/80 transition hover:text-cream-50">
      <Globe2 size={16} strokeWidth={STROKE} aria-hidden />
      <span className="sr-only">Language</span>
      <select
        value={locale}
        onChange={(event) => setLocalePreference(event.target.value as Locale)}
        className="cursor-pointer appearance-none bg-transparent pe-1 outline-none"
      >
        {LOCALES.map((option) => (
          <option key={option} value={option} lang={option} className="text-ink-900">
            {LOCALE_LABEL[option]}
          </option>
        ))}
      </select>
    </label>
  );
}
