import { describe, expect, it } from "vitest";
import { calcCombinedBalances } from "../src/settlement";
import { formatRate, mainCurrencyOf, rateSource, rateToMain } from "../src/currency-convert";
import type { Expense, Family } from "../src/types";

// ILS per unit: 1 EUR = 4 ILS, 1 GBP = 5 ILS, 1 USD = 3.6 ILS
const market = { ILS: 1, EUR: 4, GBP: 5, USD: 3.6 };

describe("rateToMain", () => {
  it("is 1 for the main currency itself", () => {
    expect(rateToMain("ILS", "ILS", market)).toBe(1);
  });
  it("uses the market table, crossing through ILS for another main currency", () => {
    expect(rateToMain("EUR", "ILS", market)).toBe(4);
    expect(rateToMain("GBP", "EUR", market)).toBeCloseTo(1.25);
    expect(rateToMain("ILS", "USD", market)).toBeCloseTo(1 / 3.6);
  });
  it("prefers the organizer's edited rate", () => {
    expect(rateToMain("EUR", "ILS", market, { EUR: 3.9 })).toBe(3.9);
  });
  it("ignores unusable overrides and returns 0 when no rate is known", () => {
    expect(rateToMain("EUR", "ILS", market, { EUR: 0 })).toBe(4);
    expect(rateToMain("THB", "ILS", market)).toBe(0);
    expect(rateToMain("EUR", "ILS", null)).toBe(0);
  });
});

describe("rateSource", () => {
  it("tells edited from market from same", () => {
    expect(rateSource("EUR", "ILS", { EUR: 3.9 })).toBe("edited");
    expect(rateSource("EUR", "ILS")).toBe("market");
    expect(rateSource("ILS", "ILS")).toBe("same");
  });
});

describe("mainCurrencyOf", () => {
  const base = { legacy: false, stops: [{ currency: "GBP" }] };
  it("defaults to ILS when offered, else the first currency", () => {
    expect(mainCurrencyOf(base)).toBe("ILS");
    expect(mainCurrencyOf({ ...base, currencies: ["GBP", "USD"] })).toBe("GBP");
  });
  it("honours the organizer's choice", () => {
    expect(mainCurrencyOf({ ...base, mainCurrency: "USD" })).toBe("USD");
  });
});

describe("formatRate", () => {
  it("keeps useful precision for tiny and large rates", () => {
    expect(formatRate(4.0213)).toBe("4.02");
    expect(formatRate(0.00112)).toBe("0.00112");
    expect(formatRate(0)).toBe("");
  });
});

describe("combined settle-up in the main currency", () => {
  const families: Family[] = [
    { id: "a", name: "A", members: [] },
    { id: "b", name: "B", members: [] },
  ];
  it("converts every expense with the per-currency rates", () => {
    const expense = (id: string, currency: string, amount: number, payer: string): Expense =>
      ({ id, description: id, amount, currency, date: "2026-10-23", payerFamilyId: payer, participantFamilyIds: null }) as Expense;
    const expenses = [expense("1", "GBP", 100, "a"), expense("2", "ILS", 100, "b")];
    const balances = calcCombinedBalances(expenses, families, {
      GBP: rateToMain("GBP", "ILS", market),
      ILS: 1,
    });
    // A paid 500 ILS-equivalent, B paid 100: total 600, each owes 300
    expect(balances.find((b) => b.familyId === "a")?.balance).toBeCloseTo(200);
    expect(balances.find((b) => b.familyId === "b")?.balance).toBeCloseTo(-200);
  });
});
