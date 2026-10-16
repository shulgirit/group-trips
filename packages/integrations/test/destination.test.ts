import { afterEach, describe, expect, it, vi } from "vitest";
import { autocompleteDestination } from "../src/destination";

afterEach(() => vi.unstubAllGlobals());

describe("autocompleteDestination", () => {
  it("sends at most 5 primary types and falls back to an unfiltered search", async () => {
    process.env.GOOGLE_MAPS_SERVER_API_KEY = "test";
    const bodies: { includedPrimaryTypes?: string[] }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body));
        bodies.push(body);
        const suggestions = body.includedPrimaryTypes
          ? []
          : [{ placePrediction: { placeId: "p1", structuredFormat: { mainText: { text: "Sardinia" }, secondaryText: { text: "Italy" } } } }];
        return new Response(JSON.stringify({ suggestions }), { status: 200 });
      })
    );
    const result = await autocompleteDestination("Sardin");
    expect(bodies[0].includedPrimaryTypes!.length).toBeLessThanOrEqual(5);
    expect(bodies[1].includedPrimaryTypes).toBeUndefined();
    expect(result).toEqual([{ placeId: "p1", label: "Sardinia", secondary: "Italy" }]);
  });
});
