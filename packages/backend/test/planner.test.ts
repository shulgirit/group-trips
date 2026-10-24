import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import { makeTest, userClient } from "./setup";

const stop = { label: "Hanoi", placeId: "p1", lat: 21.03, lng: 105.85, region: "Hanoi", country: "VN", timezone: "Asia/Ho_Chi_Minh", currency: "VND", coverImage: null };
const outline = {
  title: "Passover in Vietnam",
  emoji: "sun",
  summary: "Food and nature",
  datesReason: "Passover window",
  tips: ["Carry matzah"],
  startDate: "2027-04-21",
  stops: [
    { label: "Hanoi", country: "VN", nights: 2 },
    { label: "Ninh Binh", country: "VN", nights: 2 },
  ],
  group: { kind: "families", name: "", adults: 2, kidAges: [6, 9] },
};
// A query with a non-ASCII character: Convex rejects those as object keys, so geos travel as a list
const hotelQuery = "Little Riverside Hoi An – A Luxury Hotel & Spa, Hanoi";
const days = [
  { dayNumber: 1, stopLabel: "Hanoi", items: [
    { time: "09:00", title: "Old Quarter walk", kind: "attraction", query: "Old Quarter, Hanoi", durationMin: 120, why: "Start here" },
    { time: "13:00", title: "Bun cha lunch", kind: "restaurant", query: "Bun Cha Huong Lien, Hanoi", durationMin: 60, why: "Famous" },
    { time: "15:00", title: "Check in", kind: "stay", query: hotelQuery, durationMin: 30, why: "Hotel" },
    { time: "18:00", title: "Train north", kind: "transport", query: "", durationMin: 120, why: "" },
  ] },
  { dayNumber: 3, stopLabel: "Ninh Binh", items: [{ time: "10:00", title: "Tam Coc boat", kind: "activity", query: "Tam Coc, Ninh Binh", durationMin: 150, why: "Scenic" }] },
];
const geo = (lat: number) => ({ lat, lng: 105 + lat / 100, address: "Somewhere", photoUrl: "https://example.com/p.jpg" });
const geos = [
  { query: "Old Quarter, Hanoi", geo: geo(21.03) },
  { query: "Bun Cha Huong Lien, Hanoi", geo: geo(21.02) },
  { query: hotelQuery, geo: geo(21.01) },
  { query: "Tam Coc, Ninh Binh", geo: null },
];

async function plan() {
  const t = makeTest();
  const owner = await userClient(t, { name: "Omer Tal" });
  const runId = await t.run((ctx) => ctx.db.insert("planRuns", { userId: owner.userId, text: "Vietnam for Pesach", locale: "en", status: "running", phase: "building", createdAt: Date.now() }));
  const tripId = await t.mutation(internal.plannerData.build, { runId, outline, days, stops: [stop, { ...stop, label: "Ninh Binh" }], geos });
  return { t, owner, runId, tripId };
}

afterEach(() => vi.unstubAllEnvs());

describe("planner build", () => {
  it("creates a private tentative trip with events, places and consecutive stops", async () => {
    const { t, owner, runId, tripId } = await plan();
    const snap = await t.run(async (ctx) => ({
      trip: (await ctx.db.get(tripId))!,
      run: (await ctx.db.get(runId))!,
      events: await ctx.db.query("events").withIndex("by_trip_day", (q) => q.eq("tripId", tripId)).collect(),
      places: await ctx.db.query("places").withIndex("by_trip", (q) => q.eq("tripId", tripId)).collect(),
      invites: await ctx.db.query("invites").withIndex("by_trip", (q) => q.eq("tripId", tripId)).collect(),
    }));
    expect(snap.trip).toMatchObject({ tentative: true, datesApproximate: true, plannedFrom: "ai", startDate: "2027-04-21", endDate: "2027-04-25" });
    expect(snap.trip.stops.map((s) => [s.label, s.startDate, s.endDate])).toEqual([["Hanoi", "2027-04-21", "2027-04-23"], ["Ninh Binh", "2027-04-23", "2027-04-25"]]);
    expect(snap.trip.planNotes).toContain("Carry matzah");
    expect(snap.events).toHaveLength(5);
    expect(snap.events.every((e) => e.source === "ai_plan")).toBe(true);
    expect(snap.events.find((e) => e.title === "Tam Coc boat")?.day).toBe("2027-04-23");
    expect(snap.events.find((e) => e.title === "Train north")?.placeId ?? null).toBeNull();
    expect(snap.places).toHaveLength(3);
    expect(snap.places.find((p) => p.stayFrom)).toMatchObject({ stayFrom: "2027-04-21", stayTo: "2027-04-23", source: "ai_plan" });
    expect(snap.invites).toHaveLength(0);
    expect(snap.run).toMatchObject({ status: "done", tripId });
    expect(await owner.as.query(api.trips.mine, {})).toHaveLength(1);
  });

  it("confirmDates moves stops, events and stays together; only organizers can", async () => {
    const { t, owner, tripId } = await plan();
    await owner.as.mutation(api.trips.confirmDates, { tripId, startDate: "2027-05-01" });
    const after = await t.run(async (ctx) => ({
      trip: (await ctx.db.get(tripId))!,
      days: (await ctx.db.query("events").withIndex("by_trip_day", (q) => q.eq("tripId", tripId)).collect()).map((e) => e.day).sort(),
      stay: (await ctx.db.query("places").withIndex("by_trip", (q) => q.eq("tripId", tripId)).collect()).find((p) => p.stayFrom),
    }));
    expect(after.trip).toMatchObject({ startDate: "2027-05-01", endDate: "2027-05-05", datesApproximate: false });
    expect(after.trip.stops[1]).toMatchObject({ startDate: "2027-05-03", endDate: "2027-05-05" });
    expect(after.days[0]).toBe("2027-05-01");
    expect(after.days[after.days.length - 1]).toBe("2027-05-03");
    expect(after.stay).toMatchObject({ stayFrom: "2027-05-01", stayTo: "2027-05-03" });

    const stranger = await userClient(t);
    await expect(stranger.as.mutation(api.trips.confirmDates, { tripId, startDate: "2027-06-01" })).rejects.toThrow();
  });

  it("publish clears the flag and creates an invite; a second publish is a no-op", async () => {
    const { t, owner, tripId } = await plan();
    expect(await owner.as.mutation(api.trips.publish, { tripId })).toMatchObject({ published: true });
    const after = await t.run(async (ctx) => ({
      trip: (await ctx.db.get(tripId))!,
      invites: (await ctx.db.query("invites").withIndex("by_trip", (q) => q.eq("tripId", tripId)).collect()).length,
    }));
    expect(after.trip.tentative).toBe(false);
    expect(after.invites).toBeGreaterThan(0);
    expect(await owner.as.mutation(api.trips.publish, { tripId })).toMatchObject({ published: false });
  });
});

describe("planner limits", () => {
  it("rejects short text, a second concurrent run and the sixth plan in 30 days", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test");
    const t = makeTest();
    const user = await userClient(t, { name: "Dana" });
    await expect(user.as.mutation(api.planner.start, { text: "hi" })).rejects.toThrow();

    // Five finished plans already used up the month
    await t.run(async (ctx) => {
      for (let i = 0; i < 5; i++) await ctx.db.insert("planRuns", { userId: user.userId, text: `plan ${i} text`, locale: "en", status: "done", phase: "done", createdAt: Date.now() - i * 1000 });
    });
    expect(await user.as.query(api.planner.quota, {})).toEqual({ left: 0, limit: 5 });
    await expect(user.as.mutation(api.planner.start, { text: "A long weekend in Rome" })).rejects.toThrow();

    // Failed runs do not count, but a running one blocks a new start
    const other = await userClient(t, { name: "Noa" });
    await t.run((ctx) => ctx.db.insert("planRuns", { userId: other.userId, text: "failed plan one", locale: "en", status: "failed", phase: "building", createdAt: Date.now() }));
    expect((await other.as.query(api.planner.quota, {})).left).toBe(5);
    await t.run((ctx) => ctx.db.insert("planRuns", { userId: other.userId, text: "running plan one", locale: "en", status: "running", phase: "days", createdAt: Date.now() }));
    await expect(other.as.mutation(api.planner.start, { text: "A long weekend in Rome" })).rejects.toThrow();
  });
});
