import { afterEach, describe, expect, it } from "vitest";
import { translate } from "../src/translate";

// React Native's Hermes has no Intl.PluralRules; translate falls back to its own rules.
const native = Intl.PluralRules;
afterEach(() => {
  (Intl as { PluralRules: unknown }).PluralRules = native;
});

describe("plurals without Intl.PluralRules", () => {
  it("matches the native rules for 0–120 in every locale", () => {
    for (const locale of ["he", "en", "ar", "es"] as const) {
      const expected = Array.from({ length: 121 }, (_, n) => translate(locale, "trip.home.group", { count: n }));
      (Intl as { PluralRules: unknown }).PluralRules = undefined;
      const fallback = Array.from({ length: 121 }, (_, n) => translate(locale, "trip.home.group", { count: n }));
      (Intl as { PluralRules: unknown }).PluralRules = native;
      expect(fallback).toEqual(expected);
    }
  });
});
