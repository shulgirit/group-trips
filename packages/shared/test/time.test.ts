import { describe, expect, it } from "vitest";
import { zonedTimeToUtc } from "../src/time";

describe("zonedTimeToUtc", () => {
  it("converts summer time in Rome (UTC+2)", () => {
    expect(zonedTimeToUtc("2026-08-16", "18:30", "Europe/Rome")).toBe(Date.UTC(2026, 7, 16, 16, 30));
  });
  it("converts winter time in Rome (UTC+1)", () => {
    expect(zonedTimeToUtc("2026-12-01", "09:00", "Europe/Rome")).toBe(Date.UTC(2026, 11, 1, 8, 0));
  });
  it("handles Jerusalem and negative offsets", () => {
    expect(zonedTimeToUtc("2026-11-05", "15:00", "Asia/Jerusalem")).toBe(Date.UTC(2026, 10, 5, 13, 0));
    expect(zonedTimeToUtc("2026-07-04", "12:00", "America/New_York")).toBe(Date.UTC(2026, 6, 4, 16, 0));
  });
  it("is stable on the DST change day", () => {
    // Europe switches to summer time on 2026-03-29 at 02:00 → 03:00
    expect(zonedTimeToUtc("2026-03-29", "12:00", "Europe/Rome")).toBe(Date.UTC(2026, 2, 29, 10, 0));
  });
  it("rejects malformed input and unknown zones", () => {
    expect(zonedTimeToUtc("16/08/2026", "18:30", "Europe/Rome")).toBeNull();
    expect(zonedTimeToUtc("2026-08-16", "6pm", "Europe/Rome")).toBeNull();
    expect(zonedTimeToUtc("2026-08-16", "18:30", "Mars/Olympus")).toBeNull();
  });
});
