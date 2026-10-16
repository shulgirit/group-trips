import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import { REMINDER_LEAD_MIN } from "../convex/events";
import { makeTest, tripInput, userClient } from "./setup";

async function setup() {
  const t = makeTest();
  const owner = await userClient(t, { name: "Omer" });
  const tripId = await owner.as.mutation(api.trips.create, { input: tripInput() });
  const code = await t.run(async (ctx) => (await ctx.db.query("invites").withIndex("by_trip", (q) => q.eq("tripId", tripId)).first())!.code);
  return { t, owner, tripId, code };
}

describe("leaving and removal delete personal data", () => {
  it("leave removes the seat, votes, private docs and location, keeps shared places anonymous", async () => {
    vi.useFakeTimers();
    const { t, owner, tripId, code } = await setup();
    const member = await userClient(t, { name: "Dana" });
    await member.as.mutation(api.invites.redeem, { code });

    const place = await member.as.mutation(api.places.add, { tripId, input: { name: "Isola Bella beach", category: "beach", imageUrl: "https://example.com/b.jpg" } });
    const pollId = await owner.as.mutation(api.polls.create, { tripId, question: "Q?", options: [{ label: "A" }, { label: "B" }] });
    const [poll] = await owner.as.query(api.polls.list, { tripId });
    await member.as.mutation(api.polls.vote, { tripId, pollId, optionId: poll.options[0].id });
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob(["x"], { type: "text/plain" })));
    await member.as.mutation(api.documents.create, { tripId, storageId, name: "notes.txt", visibility: "private" });
    await member.as.mutation(api.locations.share, { tripId, lat: 37.8, lng: 15.2, expiresAt: Date.now() + 3_600_000 });

    await member.as.mutation(api.memberships.leave, { tripId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const counts = await t.run(async (ctx) => ({
      seat: (await ctx.db.query("memberships").withIndex("by_trip_user", (q) => q.eq("tripId", tripId).eq("userId", member.userId)).unique()) !== null,
      votes: (await ctx.db.query("pollVotes").withIndex("by_trip_user", (q) => q.eq("tripId", tripId).eq("userId", member.userId)).collect()).length,
      docs: (await ctx.db.query("documents").withIndex("by_trip_owner", (q) => q.eq("tripId", tripId).eq("ownerId", member.userId)).collect()).length,
      locations: (await ctx.db.query("locations").withIndex("by_trip_user", (q) => q.eq("tripId", tripId).eq("userId", member.userId)).collect()).length,
      file: await ctx.storage.getUrl(storageId),
      place: await ctx.db.get(place.id),
    }));
    expect(counts).toMatchObject({ seat: false, votes: 0, docs: 0, locations: 0, file: null });
    expect(counts.place?.createdBy).toBeUndefined();
    expect(counts.place?.name).toBe("Isola Bella beach");
    vi.useRealTimers();
  });

  it("the owner can't leave; deleting the trip removes everything", async () => {
    vi.useFakeTimers();
    const { t, owner, tripId, code } = await setup();
    const member = await userClient(t);
    await member.as.mutation(api.invites.redeem, { code });
    await expect(owner.as.mutation(api.memberships.leave, { tripId })).rejects.toThrow();
    await owner.as.mutation(api.places.add, { tripId, input: { name: "Trattoria da Nino", category: "restaurant", imageUrl: "https://example.com/n.jpg" } });

    await owner.as.mutation(api.trips.remove, { tripId });
    expect(await owner.as.query(api.trips.mine, {})).toHaveLength(0);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const left = await t.run(async (ctx) => ({
      trip: await ctx.db.get(tripId),
      places: (await ctx.db.query("places").withIndex("by_trip", (q) => q.eq("tripId", tripId)).collect()).length,
      families: (await ctx.db.query("families").withIndex("by_trip", (q) => q.eq("tripId", tripId)).collect()).length,
      invites: (await ctx.db.query("invites").withIndex("by_trip", (q) => q.eq("tripId", tripId)).collect()).length,
    }));
    expect(left).toEqual({ trip: null, places: 0, families: 0, invites: 0 });
    vi.useRealTimers();
  });
});

describe("guest device signs in for real", () => {
  it("moves trip seats and votes to the real account", async () => {
    const { t, owner, tripId, code } = await setup();
    const guest = await userClient(t, { guest: true });
    await guest.as.mutation(api.invites.redeem, { code });
    const pollId = await owner.as.mutation(api.polls.create, { tripId, question: "Q?", options: [{ label: "A" }] });
    const [poll] = await owner.as.query(api.polls.list, { tripId });
    await guest.as.mutation(api.polls.vote, { tripId, pollId, optionId: poll.options[0].id });

    const real = await userClient(t, { name: "Noa" });
    const [fromAuthId, toAuthId] = await t.run(async (ctx) => [(await ctx.db.get(guest.userId))!.authId, (await ctx.db.get(real.userId))!.authId]);
    await t.mutation(internal.account.mergeGuest, { fromAuthId, toAuthId });

    const trips = await real.as.query(api.trips.mine, {});
    expect(trips.map((trip) => trip.id)).toEqual([tripId]);
    const [after] = await real.as.query(api.polls.list, { tripId });
    expect(after.myVote).toBe(poll.options[0].id);
  });
});

describe("event reminders", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2099-08-16T06:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("schedules one reminder before the start and reschedules when the event moves", async () => {
    const { t, owner, tripId } = await setup();
    const input = { title: "Dinner", day: "2099-08-16", startTime: "20:00", participants: { type: "all" as const } };
    const eventId = await owner.as.mutation(api.events.add, { tripId, input });
    const job = async () =>
      t.run(async (ctx) => {
        const event = (await ctx.db.get(eventId))!;
        return event.reminderJobId ? await ctx.db.system.get(event.reminderJobId) : null;
      });
    const first = await job();
    // 20:00 Rome (UTC+2) = 18:00Z, minus the lead time
    expect(first?.scheduledTime).toBe(Date.UTC(2099, 7, 16, 18, 0) - REMINDER_LEAD_MIN * 60_000);

    await owner.as.mutation(api.events.update, { tripId, eventId, input: { ...input, startTime: "21:00" } });
    const moved = await job();
    expect(moved?.scheduledTime).toBe(Date.UTC(2099, 7, 16, 19, 0) - REMINDER_LEAD_MIN * 60_000);
    const old = await t.run((ctx) => ctx.db.system.get(first!._id));
    expect(old?.state.kind).toBe("canceled");
  });

  it("does not schedule reminders for events that already started", async () => {
    const { owner, t, tripId } = await setup();
    const eventId = await owner.as.mutation(api.events.add, {
      tripId,
      input: { title: "Breakfast", day: "2099-08-16", startTime: "07:00", participants: { type: "all" as const } },
    });
    const event = await t.run((ctx) => ctx.db.get(eventId));
    expect(event?.reminderJobId).toBeUndefined();
  });
});
