import type { BookingItem } from "@together/shared/booking";
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

const booking = (over: Partial<BookingItem>): BookingItem => ({
  kind: "activity", title: "", startDate: "", startTime: "", endDate: "", endTime: "", location: "", city: "", confirmationCode: "", flightNumber: "", from: "", to: "", travelers: [], notes: "", ...over,
});

describe("bookings reshape a tentative plan", () => {
  it("a flight and hotel anchor the dates, the hotel replaces the suggested stay, a ticket replaces its suggestion", async () => {
    const { t, owner, tripId } = await plan();
    const importId = await t.run((ctx) => ctx.db.insert("imports", { tripId, createdBy: owner.userId, fileName: "x.pdf", storageId: null, contentType: "application/pdf", size: 1, status: "review", items: [], createdAt: Date.now() }));
    const items = [
      booking({ kind: "flight", title: "Flight to Hanoi", flightNumber: "VN 1", from: "Tel Aviv (TLV)", to: "Hanoi (HAN)", startDate: "2027-05-02", startTime: "22:00", endDate: "2027-05-03", endTime: "06:00" }),
      booking({ kind: "lodging", title: "Hotel Sofitel Legend", location: "15 Ngo Quyen", city: "Hanoi", startDate: "2027-05-03", endDate: "2027-05-05" }),
      booking({ kind: "activity", title: "Old Quarter food tour", location: "Old Quarter, Hanoi", city: "Hanoi", startDate: "2027-05-04", startTime: "10:30", endDate: "2027-05-04", endTime: "12:30" }),
    ];
    const summary = await owner.as.mutation(internal.imports.applyPlan, { tripId, importId, items, geocodes: [null, { lat: 21.02, lng: 105.86 }, null], locale: "en" });
    expect(summary).toMatchObject({ datesMoved: { from: "2027-04-21", to: "2027-05-03" }, staysReplaced: 1, eventsReplaced: 1 });

    const after = await t.run(async (ctx) => ({
      trip: (await ctx.db.get(tripId))!,
      events: await ctx.db.query("events").withIndex("by_trip_day", (q) => q.eq("tripId", tripId)).collect(),
      stays: (await ctx.db.query("places").withIndex("by_trip", (q) => q.eq("tripId", tripId)).collect()).filter((p) => p.category === "accommodation"),
    }));
    expect(after.trip).toMatchObject({ startDate: "2027-05-03", datesApproximate: false });
    // One stay left: the real hotel, with the booking's nights; the suggested hotel is gone
    expect(after.stays).toHaveLength(1);
    expect(after.stays[0]).toMatchObject({ name: "Hotel Sofitel Legend", source: "booking", stayFrom: "2027-05-03", stayTo: "2027-05-05" });
    expect(after.events.find((e) => e.title === "Check in")).toBeUndefined();
    expect(after.events.filter((e) => e.title.includes("Sofitel Legend")).map((e) => e.day).sort()).toEqual(["2027-05-03", "2027-05-05"]);
    // The walk became the booked tour (same place, new day and time), not a duplicate
    const tour = after.events.find((e) => e.title === "Old Quarter food tour")!;
    expect(tour).toMatchObject({ day: "2027-05-04", startTime: "10:30", source: "booking" });
    expect(after.events.find((e) => e.title === "Old Quarter walk")).toBeUndefined();
    // The rest of the plan moved with the dates and stays a suggestion
    expect(after.events.find((e) => e.title === "Bun cha lunch")).toMatchObject({ day: "2027-05-03", source: "ai_plan" });
  });

  it("leaves an exact plan alone when bookings fit and reports a booked end that differs", async () => {
    const { t, owner, tripId } = await plan();
    const importId = await t.run((ctx) => ctx.db.insert("imports", { tripId, createdBy: owner.userId, fileName: "x.pdf", storageId: null, contentType: "application/pdf", size: 1, status: "review", items: [], createdAt: Date.now() }));
    const items = [booking({ kind: "flight", title: "Return flight", flightNumber: "VN 2", from: "Hanoi (HAN)", to: "Tel Aviv (TLV)", startDate: "2027-04-23", startTime: "20:00", endDate: "2027-04-24", endTime: "05:00" })];
    const summary = await owner.as.mutation(internal.imports.applyPlan, { tripId, importId, items, geocodes: [null], locale: "en" });
    expect(summary.datesMoved).toBeNull();
    // The plan was two days longer than the flight home: it ends on the flight's day now
    expect(summary.bookedEnd).toBeNull();
    expect((await t.run((ctx) => ctx.db.get(tripId)))!.endDate).toBe("2027-04-23");
  });

  it("drops suggestions before you land and after you fly home", async () => {
    const { t, owner, tripId } = await plan();
    const importId = await t.run((ctx) => ctx.db.insert("imports", { tripId, createdBy: owner.userId, fileName: "x.pdf", storageId: null, contentType: "application/pdf", size: 1, status: "review", items: [], createdAt: Date.now() }));
    const items = [
      booking({ kind: "flight", title: "Flight to Hanoi", from: "Tel Aviv (TLV)", to: "Hanoi (HAN)", startDate: "2027-04-21", startTime: "01:00", endDate: "2027-04-21", endTime: "11:00" }),
      booking({ kind: "flight", title: "Flight home", from: "Hanoi (HAN)", to: "Tel Aviv (TLV)", startDate: "2027-04-22", startTime: "21:00", endDate: "2027-04-23", endTime: "06:00" }),
    ];
    const summary = await owner.as.mutation(internal.imports.applyPlan, { tripId, importId, items, geocodes: [null, null], locale: "en" });
    // Landing 11:00 + 2h buffer: the 09:00 and 13:00 items of day 1... 13:00 stays (>= 13:00), 09:00 goes. Flight home at 21:00 on day 2 (none planned there), day 3 is cut.
    const left = (await t.run((ctx) => ctx.db.query("events").withIndex("by_trip_day", (q) => q.eq("tripId", tripId)).collect())).filter((e) => e.source === "ai_plan").map((e) => e.title);
    expect(left).not.toContain("Old Quarter walk");
    expect(left).not.toContain("Tam Coc boat");
    expect(left).toContain("Bun cha lunch");
    expect(summary.trimmed).toBe(2);
    expect((await t.run((ctx) => ctx.db.get(tripId)))!.endDate).toBe("2027-04-22");
  });
});
