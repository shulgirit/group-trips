import { describe, expect, it } from "vitest";
import { daysBetween, resolveDatePhrase, shiftIso } from "../src/holidays";

describe("resolveDatePhrase: holidays follow the Hebrew calendar", () => {
  it("Passover 2027 (15 Nisan 5787 = 22 April 2027)", () => {
    expect(resolveDatePhrase("a trip in Pesach with the kids", "2026-10-24")).toMatchObject({ start: "2027-04-21", end: "2027-04-29", label: "Passover" });
  });
  it("Hebrew words work too, and the following year is chosen after the holiday passed", () => {
    expect(resolveDatePhrase("טיול בפסח", "2027-05-01")).toMatchObject({ label: "Passover", start: "2028-04-10" });
  });
  it("Sukkot 2026 (15 Tishri 5787 = 26 September 2026)", () => {
    expect(resolveDatePhrase("sukkot week abroad", "2026-08-01")).toMatchObject({ start: "2026-09-25", end: "2026-10-03", label: "Sukkot" });
  });
  it("Hanukkah 2026 starts 5 December", () => {
    expect(resolveDatePhrase("hanukkah getaway", "2026-10-24")).toMatchObject({ start: "2026-12-05", end: "2026-12-12", label: "Hanukkah" });
  });
});

describe("resolveDatePhrase: seasons and months", () => {
  it("seasons are left to the model (hemisphere depends on the destination)", () => {
    expect(resolveDatePhrase("Vietnam in the summer", "2026-10-24")).toBeNull();
  });
  it("Easter (Western and Orthodox), Lunar New Year and Islamic holidays", () => {
    expect(resolveDatePhrase("Easter in Lisbon", "2026-10-24")).toMatchObject({ label: "Easter", start: "2027-03-21", end: "2027-03-29" });
    expect(resolveDatePhrase("Orthodox Easter in Athens", "2026-10-24")).toMatchObject({ label: "Orthodox Easter", start: "2027-04-25", end: "2027-05-03" });
    expect(resolveDatePhrase("Chinese New Year in Hanoi", "2026-10-24")).toMatchObject({ label: "Lunar New Year", start: expect.stringMatching(/^2027-02-0[4-6]$/) });
    expect(resolveDatePhrase("Eid in Istanbul", "2026-10-24")?.label).toBe("Eid al-Fitr");
    expect(resolveDatePhrase("Ramadan", "2026-10-24")?.start).toMatch(/^2027-02/);
  });
  it("the Israeli school summer vacation is its own window", () => {
    expect(resolveDatePhrase("בחופש הגדול", "2027-03-01")).toMatchObject({ start: "2027-07-05", end: "2027-08-25" });
  });
  it("a month name covers the whole month; December to January wraps the year", () => {
    expect(resolveDatePhrase("somewhere warm in November", "2026-10-24")).toMatchObject({ start: "2026-11-01", end: "2026-11-30" });
    expect(resolveDatePhrase("christmas in Prague", "2026-10-24")).toMatchObject({ start: "2026-12-20", end: "2027-01-02" });
  });
  it("returns null when there is no date phrase", () => {
    expect(resolveDatePhrase("we love food and nature", "2026-10-24")).toBeNull();
  });
});

describe("date helpers", () => {
  it("counts inclusive days and shifts ISO dates", () => {
    expect(daysBetween("2027-04-21", "2027-04-29")).toBe(9);
    expect(shiftIso("2027-02-27", 3)).toBe("2027-03-02");
  });
});
