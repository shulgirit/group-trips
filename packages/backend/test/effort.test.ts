import { describe, expect, it } from "vitest";
import { firstRoundEffort } from "../../integrations/src/ai-chat";

const turn = (content: string) => [{ role: "user" as const, content }];

describe("firstRoundEffort", () => {
  it("answers short everyday questions without hidden reasoning", () => {
    expect(firstRoundEffort(turn("תמצא Plan B אם יורד גשם"))).toBe("none");
    expect(firstRoundEffort(turn("what time is dinner?"))).toBe("none");
  });
  it("keeps deep reasoning for planning requests", () => {
    expect(firstRoundEffort(turn("תתכנן לנו יום באתנה"))).toBe("medium");
    expect(firstRoundEffort(turn("plan our day in Taormina"))).toBe("medium");
  });
});
