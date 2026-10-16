import { describe, expect, it } from "vitest";
import { calcBalances, calcCombinedBalances, calcSettlement } from "../src/settlement";
import type { Expense, Family } from "../src/types";

const family = (id: string): Family => ({ id, name: id, color: "sea", members: [], order: 0 });
const families = [family("tal"), family("levi"), family("cohen")];
const expense = (over: Partial<Expense>): Expense => ({
  id: Math.random().toString(36),
  payerFamilyId: "tal",
  description: "",
  amount: 0,
  currency: "EUR",
  date: "2026-08-16",
  participantFamilyIds: null,
  ...over,
});
const byId = (rows: { familyId: string; balance: number }[]) =>
  Object.fromEntries(rows.map((r) => [r.familyId, Math.round(r.balance * 100) / 100]));

describe("calcBalances", () => {
  it("splits equally between all families when no participants are set", () => {
    const rows = calcBalances([expense({ amount: 90 })], families, "EUR");
    expect(byId(rows)).toEqual({ tal: 60, levi: -30, cohen: -30 });
  });

  it("splits per person when participant counts are given", () => {
    const rows = calcBalances(
      [expense({ amount: 100, participantFamilyIds: ["tal", "levi"], participantCounts: { tal: 3, levi: 1 } })],
      families,
      "EUR"
    );
    expect(byId(rows)).toEqual({ tal: 25, levi: -25, cohen: 0 });
  });

  it("ignores other currencies and unknown families", () => {
    const rows = calcBalances(
      [expense({ amount: 50, currency: "ILS" }), expense({ amount: 30, participantFamilyIds: ["ghost"] })],
      families,
      "EUR"
    );
    expect(byId(rows)).toEqual({ tal: 0, levi: 0, cohen: 0 });
  });

  it("treats a settlement as money moving from payer to receiver", () => {
    const rows = calcBalances(
      [
        expense({ amount: 90 }),
        expense({ kind: "settlement", payerFamilyId: "levi", participantFamilyIds: ["tal"], amount: 30 }),
      ],
      families,
      "EUR"
    );
    expect(byId(rows)).toEqual({ tal: 30, levi: 0, cohen: -30 });
  });
});

describe("calcCombinedBalances", () => {
  it("converts to ILS and skips currencies without a rate", () => {
    const rows = calcCombinedBalances(
      [expense({ amount: 30, currency: "EUR" }), expense({ amount: 10, currency: "USD", payerFamilyId: "levi" })],
      families,
      { EUR: 4, ILS: 1 }
    );
    expect(byId(rows)).toEqual({ tal: 80, levi: -40, cohen: -40 });
  });
});

describe("calcSettlement", () => {
  it("zeroes everyone out with the fewest transfers", () => {
    const transfers = calcSettlement([
      { familyId: "tal", paid: 0, share: 0, balance: 60 },
      { familyId: "levi", paid: 0, share: 0, balance: -30 },
      { familyId: "cohen", paid: 0, share: 0, balance: -30 },
    ]);
    expect(transfers).toEqual([
      { fromFamilyId: "levi", toFamilyId: "tal", amount: 30 },
      { fromFamilyId: "cohen", toFamilyId: "tal", amount: 30 },
    ]);
  });

  it("ignores rounding dust", () => {
    expect(calcSettlement([
      { familyId: "a", paid: 0, share: 0, balance: 0.004 },
      { familyId: "b", paid: 0, share: 0, balance: -0.004 },
    ])).toEqual([]);
  });
});
