import { describe, expect, it } from "vitest";
import { api, internal } from "../convex/_generated/api";
import { makeTest, tripInput, userClient } from "./setup";

async function setup() {
  const t = makeTest();
  const owner = await userClient(t, { name: "Omer" });
  const tripId = await owner.as.mutation(api.trips.create, { input: tripInput() });
  const trip = await t.run((ctx) => ctx.db.get(tripId));
  const [first, second] = [trip!.startDate, trip!.stops[0].endDate];
  const add = (title: string, day: string, startTime: string, source?: "ai_plan" | "booking") =>
    t.run((ctx) => ctx.db.insert("events", { tripId, title, day, startTime, placeId: null, durationMin: 60, participants: { type: "all" }, notes: "", createdAt: Date.now(), ...(source ? { source } : {}) }));
  return { t, owner, tripId, trip: trip!, first, second, add };
}

describe("guide edit tools", () => {
  it("updateEvent moves an item, drops the suggestion flag, and refuses a day outside the trip", async () => {
    const { t, tripId, first, add } = await setup();
    const id = await add("Boat trip", first, "10:00", "ai_plan");
    const patched = await t.mutation(internal.chatTools.updateEvent, { tripId, eventId: id, patch: { startTime: "9:30", title: "Early boat trip" } });
    expect(patched).toMatchObject({ title: "Early boat trip", startTime: "09:30", source: "manual" });
    await expect(t.mutation(internal.chatTools.updateEvent, { tripId, eventId: id, patch: { day: "2099-01-01" } })).rejects.toThrow();
  });

  it("shiftDays moves a range and refuses to push items out of the trip; swapDays swaps", async () => {
    const { t, tripId, trip, add } = await setup();
    const a = await add("A", trip.startDate, "10:00");
    const b = await add("B", trip.endDate, "10:00");
    await expect(t.mutation(internal.chatTools.shiftDays, { tripId, fromDay: trip.startDate, toDay: trip.endDate, byDays: 1 })).rejects.toThrow();
    expect(await t.mutation(internal.chatTools.shiftDays, { tripId, fromDay: trip.startDate, toDay: trip.startDate, byDays: 1 })).toBe(1);
    const day = (id: typeof a) => t.run(async (ctx) => (await ctx.db.get(id))!.day);
    expect(await day(a)).not.toBe(trip.startDate);
    await t.mutation(internal.chatTools.swapDays, { tripId, dayA: await day(a), dayB: trip.endDate });
    expect(await day(a)).toBe(trip.endDate);
    expect(await day(b)).not.toBe(trip.endDate);
  });

  it("clearDay keeps bookings unless asked; deleteEvents removes only this trip's rows", async () => {
    const { t, tripId, first, add } = await setup();
    const plan = await add("Walk", first, "10:00", "ai_plan");
    const flight = await add("Flight", first, "12:00", "booking");
    expect(await t.mutation(internal.chatTools.clearDay, { tripId, day: first, includeBookings: false })).toBe(1);
    expect(await t.run((ctx) => ctx.db.get(plan))).toBeNull();
    expect(await t.run((ctx) => ctx.db.get(flight))).not.toBeNull();
    expect(await t.mutation(internal.chatTools.deleteEvents, { tripId, eventIds: [flight] })).toBe(1);
  });

  it("changeTripDates moves everything with the start date and resizes with the end date", async () => {
    const { t, tripId, trip, add } = await setup();
    const e = await add("Walk", trip.startDate, "10:00");
    const range = await t.mutation(internal.chatTools.changeTripDates, { tripId, startDate: "2031-03-01", endDate: "2031-03-12" });
    expect(range).toEqual({ startDate: "2031-03-01", endDate: "2031-03-12" });
    expect((await t.run((ctx) => ctx.db.get(e)))!.day).toBe("2031-03-01");
    expect((await t.run((ctx) => ctx.db.get(tripId)))!.stops.at(-1)!.endDate).toBe("2031-03-12");
    await expect(t.mutation(internal.chatTools.changeTripDates, { tripId, endDate: "2031-02-01" })).rejects.toThrow();
  });

  it("deletePlace unlinks its events; polls, votes and expenses work as the speaker", async () => {
    const { t, owner, tripId, first } = await setup();
    const place = await owner.as.mutation(api.places.add, { tripId, input: { name: "Isola Bella", category: "beach", imageUrl: "https://example.com/b.jpg" } });
    const eventId = await t.run((ctx) => ctx.db.insert("events", { tripId, title: "Swim", day: first, startTime: "11:00", placeId: place.id, durationMin: 60, participants: { type: "all" }, notes: "", createdAt: Date.now() }));
    await t.mutation(internal.chatTools.setHomeBase, { tripId, placeId: place.id });
    expect((await t.run((ctx) => ctx.db.get(tripId)))!.homeBase?.name).toBe("Isola Bella");
    await t.mutation(internal.chatTools.deletePlace, { tripId, placeId: place.id });
    expect((await t.run((ctx) => ctx.db.get(eventId)))!.placeId).toBeNull();

    const pollId = await owner.as.mutation(api.polls.create, { tripId, question: "Dinner?", options: [{ label: "Pizza" }, { label: "Sushi" }] });
    const poll = (await owner.as.query(api.polls.list, { tripId }))[0];
    await t.mutation(internal.chatTools.votePoll, { tripId, pollId, optionId: poll.options[1].id, userId: owner.userId });
    expect(await t.run((ctx) => ctx.db.query("pollVotes").withIndex("by_poll", (q) => q.eq("pollId", pollId)).collect())).toHaveLength(1);
    await t.mutation(internal.chatTools.setPollClosed, { tripId, pollId, closed: true });
    await expect(t.mutation(internal.chatTools.votePoll, { tripId, pollId, optionId: poll.options[0].id, userId: owner.userId })).rejects.toThrow();
    await t.mutation(internal.chatTools.deletePoll, { tripId, pollId });
    expect(await owner.as.query(api.polls.list, { tripId })).toHaveLength(0);

    const [family] = await owner.as.query(api.families.list, { tripId });
    const expenseId = await t.mutation(internal.chatTools.addExpense, { tripId, payerFamilyId: family._id, description: "Dinner", amount: 80, currency: "EUR", date: first, participantFamilyIds: null, userId: owner.userId });
    expect(await owner.as.query(api.expenses.list, { tripId })).toHaveLength(1);
    await t.mutation(internal.chatTools.deleteExpense, { tripId, expenseId });
    expect(await owner.as.query(api.expenses.list, { tripId })).toHaveLength(0);
  });

  it("replaceDay swaps suggestions for new items but keeps booked ones", async () => {
    const { t, tripId, first, add } = await setup();
    const old = await add("Old plan", first, "10:00", "ai_plan");
    const booked = await add("Museum ticket", first, "14:00", "booking");
    const geo = { lat: 38.7, lng: -9.1, address: "Rua", photoUrl: "https://example.com/p.jpg" };
    const result = await t.mutation(internal.chatTools.replaceDay, {
      tripId,
      day: first,
      stopLabel: "Lisbon",
      authorName: "Guide",
      items: [
        { time: "9:00", title: "Playground", kind: "activity", durationMin: 90, why: "Kids", query: "Parque das Nações playground, Lisbon", geo },
        { time: "12:30", title: "Lunch", kind: "restaurant", durationMin: 60, why: "Easy", query: "Time Out Market, Lisbon", geo: null },
      ],
    });
    expect(result).toEqual({ removed: 1, added: 2 });
    expect(await t.run((ctx) => ctx.db.get(old))).toBeNull();
    expect(await t.run((ctx) => ctx.db.get(booked))).not.toBeNull();
    const titles = (await t.run((ctx) => ctx.db.query("events").withIndex("by_trip_day", (q) => q.eq("tripId", tripId)).collect())).map((e) => e.title).sort();
    expect(titles).toEqual(["Lunch", "Museum ticket", "Playground"]);
  });
});
