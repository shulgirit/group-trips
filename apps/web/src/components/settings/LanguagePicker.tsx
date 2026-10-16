"use client";

import { Languages } from "lucide-react";
import { STROKE } from "@/components/ui/Icon";
import { setLocalePreference, useLocale, useT } from "@/i18n";
import { LOCALES, LOCALE_LABEL } from "@/i18n/config";
import { SURFACE } from "@/components/settings/SettingsGroup";

/** The four-locale switcher (reloads the page on change). */
export function LanguagePicker() {
  const t = useT();
  const { locale } = useLocale();
  return (
    <div className={`${SURFACE} p-4`}>
      <p className="mb-3 flex items-center gap-2 text-[15px] font-medium text-ink-900">
        <Languages size={18} strokeWidth={STROKE} aria-hidden className="shrink-0 text-ink-500" />
        {t("common.language.title")}
      </p>
      <div
        role="radiogroup"
        aria-label={t("common.language.title")}
        className="grid grid-cols-2 gap-1 rounded-2xl border border-cream-200 bg-cream-50 p-1 sm:grid-cols-4"
      >
        {LOCALES.map((option) => {
          const selected = option === locale;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={selected}
              lang={option}
              onClick={() => {
                if (!selected) setLocalePreference(option);
              }}
              className={`min-h-11 rounded-xl text-sm transition ${
                selected
                  ? "bg-sea-900 text-cream-50 shadow-sm"
                  : "text-ink-700 active:bg-cream-100"
              }`}
            >
              {LOCALE_LABEL[option]}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-ink-500">
        {t("common.language.hint")}
      </p>
    </div>
  );
}
