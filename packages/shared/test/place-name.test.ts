import { describe, expect, it } from "vitest";
import { samePlaceName } from "../src/place-name";

describe("samePlaceName", () => {
  it("matches identical names regardless of case and punctuation", () => {
    expect(samePlaceName("Teatro Antico, Taormina", "teatro antico taormina")).toBe(true);
  });
  it("matches a name with an appended description", () => {
    expect(samePlaceName("Terme Segestane", "Terme Segestane — מעיינות חמים")).toBe(true);
  });
  it("never lets a one-word town absorb a longer place", () => {
    expect(samePlaceName("Erice", "Erice Adventure Park")).toBe(false);
  });
  it("needs a reasonably long shorter name for containment", () => {
    expect(samePlaceName("Da Ni", "Trattoria Da Nino")).toBe(false);
  });
  it("never matches empty names", () => {
    expect(samePlaceName("", "")).toBe(false);
  });
});
