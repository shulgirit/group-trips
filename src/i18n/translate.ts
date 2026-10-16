import type { Locale } from "./config";
import { messages, type Messages } from "./messages";

type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${P}${K}`
    : T[K] extends Record<string, unknown>
      ? Leaves<T[K], `${P}${K}.`> | (T[K] extends PluralForms ? `${P}${K}` : never)
      : never;
}[keyof T & string];

export interface PluralForms {
  one: string;
  other: string;
  two?: string;
  zero?: string;
}

/** Every translatable key, e.g. "trip.nav.home". */
export type TKey = Leaves<Messages>;
export type TVars = Record<string, string | number>;

function lookup(locale: Locale, key: string): unknown {
  let node: unknown = messages[locale];
  for (const part of key.split(".")) {
    if (node && typeof node === "object" && part in node) {
      node = (node as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return node;
}

function interpolate(template: string, vars?: TVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match
  );
}

/**
 * Translates a key. Plural keys ({one, other, two?}) take `count`.
 * Missing keys fall back to Hebrew (source of truth), then the key itself.
 */
export function translate(locale: Locale, key: TKey, vars?: TVars & { count?: number }): string {
  let value = lookup(locale, key) ?? (locale === "he" ? undefined : lookup("en", key)) ?? lookup("he", key);
  if (value && typeof value === "object") {
    const forms = value as PluralForms;
    const count = Number(vars?.count ?? 0);
    const rule = new Intl.PluralRules(locale).select(count) as keyof PluralForms;
    value = (count === 0 && forms.zero) || forms[rule] || forms.other;
  }
  if (typeof value !== "string") return key;
  return interpolate(value, vars);
}
