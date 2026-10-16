import { describe, expect, it } from "vitest";
import { LOCALES } from "../src/config";
import { messages } from "../src/messages";
import { translate, type TKey } from "../src/translate";

function leaves(node: unknown, prefix = ""): [string, string][] {
  if (typeof node === "string") return [[prefix, node]];
  if (!node || typeof node !== "object") return [];
  return Object.entries(node).flatMap(([key, value]) => leaves(value, prefix ? `${prefix}.${key}` : key));
}
const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
// Plural forms may drop {count} ("לילה אחד"); Hebrew binds ל to the bare name
const PLURAL_FORM = /\.(zero|one|two|few|many|other)$/;
const ALLOWED = new Set(["config.ai.aboutTitle"]);

describe("translate", () => {
  it("interpolates variables", () => {
    expect(translate("en", "product.card.inDays" as TKey, { count: 3 })).toBe("In 3 days");
  });

  it("falls back to English, then Hebrew, then the key", () => {
    const he = new Map(leaves(messages.he));
    const es = new Map(leaves(messages.es));
    const missingInEs = [...new Map(leaves(messages.en)).keys()].find((key) => !es.has(key));
    if (missingInEs) {
      expect(translate("es", missingInEs as TKey)).toBe(new Map(leaves(messages.en)).get(missingInEs));
    }
    expect(translate("he", "no.such.key" as TKey)).toBe("no.such.key");
    expect(he.size).toBeGreaterThan(100);
  });

  it.each(LOCALES.filter((locale) => locale !== "he"))(
    "%s uses the same {placeholders} as Hebrew",
    (locale) => {
      const source = new Map(leaves(messages.he));
      const broken = leaves(messages[locale])
        .filter(([key, text]) => source.has(key) && !PLURAL_FORM.test(key) && !ALLOWED.has(key) && placeholders(text).join() !== placeholders(source.get(key)!).join())
        .map(([key]) => key);
      expect(broken).toEqual([]);
    }
  );
});
