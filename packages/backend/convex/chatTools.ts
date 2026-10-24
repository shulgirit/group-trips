import { isLocale } from "@together/i18n/config";
import { translate } from "@together/i18n/translate";
import { shiftIso } from "@together/shared/holidays";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import { insertEvent, scheduleReminder } from "./events";
import { fail } from "./lib/authz";
import { participants } from "./lib/validators";
import { CATEGORY, EMOJI, pad, placeName } from "./plannerData";
import { insertPlace, placeInput } from "./places";
import { shiftTripDates } from "./trips";

/**
 * What the guide can change besides adding things. Every function re-checks that the row belongs to the trip; who is
 * allowed to ask (organizer, adult, kid) is decided by the caller in chatRun.
 */

const dayOf = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const inRange = (trip: Doc<"trips">, day: string) => day >= trip.startDate && day <= trip.endDate;

async function loadTrip(ctx: MutationCtx, tripId: Id<"trips">) {
  const trip = await ctx.db.get(tripId);
  if (!trip) fail("not_found");
  return trip;
}

async function ownEvent(ctx: MutationCtx, tripId: Id<"trips">, eventId: Id<"events">) {
  const event = await ctx.db.get(eventId);
  if (!event || event.tripId !== tripId) fail("not_found");
  return event;
}

async function eventsOfTrip(ctx: MutationCtx, tripId: Id<"trips">) {
  return ctx.db.query("events").withIndex("by_trip_day", (q) => q.eq("tripId", tripId)).collect();
}

async function dropEvent(ctx: MutationCtx, event: Doc<"events">) {
  if (event.reminderJobId) await ctx.scheduler.cancel(event.reminderJobId);
  await ctx.db.delete(event._id);
}

export const updateEvent = internalMutation({
  args: {
    tripId: v.id("trips"),
    eventId: v.id("events"),
    patch: v.object({
      title: v.optional(v.string()),
      emoji: v.optional(v.string()),
      day: v.optional(v.string()),
      startTime: v.optional(v.string()),
      durationMin: v.optional(v.union(v.number(), v.null())),
      placeId: v.optional(v.union(v.id("places"), v.null())),
      participants: v.optional(participants),
      notes: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { tripId, eventId, patch }) => {
    const trip = await loadTrip(ctx, tripId);
    const event = await ownEvent(ctx, tripId, eventId);
    if (patch.day && !inRange(trip, patch.day)) fail("invalid", "day_out_of_range");
    if (patch.placeId) {
      const place = await ctx.db.get(patch.placeId);
      if (!place || place.tripId !== tripId) fail("invalid", "place");
    }
    const next = { ...patch, ...(patch.startTime ? { startTime: pad(patch.startTime) } : {}) };
    // A person changed it: it is no longer just a suggestion
    await ctx.db.patch(eventId, { ...next, ...(event.source === "ai_plan" ? { source: "manual" as const } : {}) });
    if (patch.day || patch.startTime) await scheduleReminder(ctx, trip, eventId);
    return (await ctx.db.get(eventId))!;
  },
});

export const deleteEvents = internalMutation({
  args: { tripId: v.id("trips"), eventIds: v.array(v.id("events")) },
  handler: async (ctx, { tripId, eventIds }) => {
    let removed = 0;
    for (const id of eventIds) {
      const event = await ctx.db.get(id);
      if (!event || event.tripId !== tripId) continue;
      await dropEvent(ctx, event);
      removed++;
    }
    return removed;
  },
});

export const clearDay = internalMutation({
  args: { tripId: v.id("trips"), day: v.string(), includeBookings: v.boolean() },
  handler: async (ctx, { tripId, day, includeBookings }) => {
    let removed = 0;
    for (const event of await eventsOfTrip(ctx, tripId)) {
      if (event.day !== day || (event.source === "booking" && !includeBookings)) continue;
      await dropEvent(ctx, event);
      removed++;
    }
    return removed;
  },
});

export const shiftDays = internalMutation({
  args: { tripId: v.id("trips"), fromDay: v.string(), toDay: v.string(), byDays: v.number() },
  handler: async (ctx, { tripId, fromDay, toDay, byDays }) => {
    const trip = await loadTrip(ctx, tripId);
    const moving = (await eventsOfTrip(ctx, tripId)).filter((event) => event.day >= fromDay && event.day <= toDay);
    // Refuse rather than silently pushing items outside the trip
    if (moving.some((event) => !inRange(trip, shiftIso(event.day, byDays)))) fail("invalid", "day_out_of_range");
    for (const event of moving) {
      await ctx.db.patch(event._id, { day: shiftIso(event.day, byDays) });
      await scheduleReminder(ctx, trip, event._id);
    }
    return moving.length;
  },
});

export const swapDays = internalMutation({
  args: { tripId: v.id("trips"), dayA: v.string(), dayB: v.string() },
  handler: async (ctx, { tripId, dayA, dayB }) => {
    const trip = await loadTrip(ctx, tripId);
    if (!inRange(trip, dayA) || !inRange(trip, dayB)) fail("invalid", "day_out_of_range");
    let moved = 0;
    for (const event of await eventsOfTrip(ctx, tripId)) {
      const day = event.day === dayA ? dayB : event.day === dayB ? dayA : null;
      if (!day) continue;
      await ctx.db.patch(event._id, { day });
      await scheduleReminder(ctx, trip, event._id);
      moved++;
    }
    return moved;
  },
});

/** startDate moves the whole trip; endDate only changes its length (the last stop absorbs it). */
export const changeTripDates = internalMutation({
  args: { tripId: v.id("trips"), startDate: v.optional(v.string()), endDate: v.optional(v.string()) },
  handler: async (ctx, { tripId, startDate, endDate }) => {
    if (startDate) {
      await shiftTripDates(ctx, tripId, startDate);
      await ctx.db.patch(tripId, { datesApproximate: false });
    }
    const trip = await loadTrip(ctx, tripId);
    if (endDate) {
      if (endDate < trip.startDate || dayOf(endDate) - dayOf(trip.startDate) > 120 * 86_400_000) fail("invalid", "end_date");
      const stops = trip.stops.map((stop, i) => (i === trip.stops.length - 1 ? { ...stop, endDate: endDate > stop.startDate ? endDate : stop.startDate } : stop));
      await ctx.db.patch(tripId, { endDate, stops });
    }
    await ctx.db.patch(tripId, { updatedAt: Date.now() });
    const fresh = await loadTrip(ctx, tripId);
    return { startDate: fresh.startDate, endDate: fresh.endDate };
  },
});

export const updatePlace = internalMutation({
  args: { tripId: v.id("trips"), placeId: v.id("places"), patch: v.object({ ...placeInput.partial().fields, favorite: v.optional(v.boolean()) }) },
  handler: async (ctx, { tripId, placeId, patch }) => {
    const place = await ctx.db.get(placeId);
    if (!place || place.tripId !== tripId) fail("not_found");
    await ctx.db.patch(placeId, { ...patch, ...(place.source === "ai_plan" ? { source: "manual" as const } : {}) });
  },
});

export const deletePlace = internalMutation({
  args: { tripId: v.id("trips"), placeId: v.id("places") },
  handler: async (ctx, { tripId, placeId }) => {
    const place = await ctx.db.get(placeId);
    if (!place || place.tripId !== tripId) fail("not_found");
    for (const event of await ctx.db.query("events").withIndex("by_place", (q) => q.eq("placeId", placeId)).collect()) {
      await ctx.db.patch(event._id, { placeId: null });
    }
    await ctx.db.delete(placeId);
  },
});

export const setHomeBase = internalMutation({
  args: { tripId: v.id("trips"), placeId: v.id("places") },
  handler: async (ctx, { tripId, placeId }) => {
    const place = await ctx.db.get(placeId);
    if (!place || place.tripId !== tripId) fail("not_found");
    await ctx.db.patch(tripId, { homeBase: { name: place.name, address: place.address ?? "", lat: place.lat ?? null, lng: place.lng ?? null } });
  },
});

export const votePoll = internalMutation({
  args: { tripId: v.id("trips"), pollId: v.id("polls"), optionId: v.string(), userId: v.id("users") },
  handler: async (ctx, { tripId, pollId, optionId, userId }) => {
    const poll = await ctx.db.get(pollId);
    if (!poll || poll.tripId !== tripId) fail("not_found");
    if (poll.closed) fail("invalid", "closed");
    if (!poll.options.some((option) => option.id === optionId)) fail("invalid", "option");
    const member = await ctx.db.query("memberships").withIndex("by_trip_user", (q) => q.eq("tripId", tripId).eq("userId", userId)).unique();
    const existing = await ctx.db.query("pollVotes").withIndex("by_poll_user", (q) => q.eq("pollId", pollId).eq("userId", userId)).unique();
    if (existing) await ctx.db.patch(existing._id, { optionId, name: member?.displayName });
    else await ctx.db.insert("pollVotes", { pollId, tripId, userId, optionId, name: member?.displayName ?? "" });
  },
});

export const setPollClosed = internalMutation({
  args: { tripId: v.id("trips"), pollId: v.id("polls"), closed: v.boolean() },
  handler: async (ctx, { tripId, pollId, closed }) => {
    const poll = await ctx.db.get(pollId);
    if (!poll || poll.tripId !== tripId) fail("not_found");
    await ctx.db.patch(pollId, { closed });
  },
});

export const deletePoll = internalMutation({
  args: { tripId: v.id("trips"), pollId: v.id("polls") },
  handler: async (ctx, { tripId, pollId }) => {
    const poll = await ctx.db.get(pollId);
    if (!poll || poll.tripId !== tripId) fail("not_found");
    for (const vote of await ctx.db.query("pollVotes").withIndex("by_poll", (q) => q.eq("pollId", pollId)).collect()) await ctx.db.delete(vote._id);
    await ctx.db.delete(pollId);
  },
});

export const addExpense = internalMutation({
  args: {
    tripId: v.id("trips"),
    payerFamilyId: v.id("families"),
    description: v.string(),
    amount: v.number(),
    currency: v.string(),
    date: v.string(),
    participantFamilyIds: v.union(v.array(v.id("families")), v.null()),
    userId: v.id("users"),
  },
  handler: async (ctx, { tripId, userId, ...rest }) => {
    for (const id of [rest.payerFamilyId, ...(rest.participantFamilyIds ?? [])]) {
      const family = await ctx.db.get(id);
      if (!family || family.tripId !== tripId) fail("invalid", "family");
    }
    return ctx.db.insert("expenses", { tripId, ...rest, createdBy: userId, createdAt: Date.now() });
  },
});

export const deleteExpense = internalMutation({
  args: { tripId: v.id("trips"), expenseId: v.id("expenses") },
  handler: async (ctx, { tripId, expenseId }) => {
    const expense = await ctx.db.get(expenseId);
    if (!expense || expense.tripId !== tripId) fail("not_found");
    await ctx.db.delete(expenseId);
  },
});

const replanItem = v.object({
  time: v.string(),
  title: v.string(),
  kind: v.string(),
  durationMin: v.number(),
  why: v.string(),
  query: v.string(),
  geo: v.union(v.object({ lat: v.number(), lng: v.number(), address: v.optional(v.string()), photoUrl: v.optional(v.string()) }), v.null()),
});

/** Swaps a day's suggestions for freshly planned ones; booked items stay. */
export const replaceDay = internalMutation({
  args: { tripId: v.id("trips"), day: v.string(), stopLabel: v.string(), items: v.array(replanItem), authorName: v.string() },
  handler: async (ctx, { tripId, day, stopLabel, items, authorName }) => {
    const trip = await loadTrip(ctx, tripId);
    if (!inRange(trip, day)) fail("invalid", "day_out_of_range");
    let removed = 0;
    for (const event of await eventsOfTrip(ctx, tripId)) {
      if (event.day !== day || event.source === "booking") continue;
      await dropEvent(ctx, event);
      removed++;
    }
    const author = { name: authorName, aiName: trip.ai.name };
    let added = 0;
    for (const item of items) {
      const kind = (item.kind in EMOJI ? item.kind : "activity") as keyof typeof EMOJI;
      let placeId: Id<"places"> | null = null;
      if (item.geo && kind !== "transport") {
        const result = await insertPlace(
          ctx,
          tripId,
          {
            name: placeName(item.query, stopLabel, item.title).slice(0, 120),
            category: CATEGORY[kind as keyof typeof CATEGORY],
            area: stopLabel,
            ...(item.geo.address ? { address: item.geo.address } : {}),
            lat: item.geo.lat,
            lng: item.geo.lng,
            ...(item.geo.photoUrl ? { imageUrl: item.geo.photoUrl } : {}),
            ...(item.why ? { tips: item.why } : {}),
            recommendedDurationMin: item.durationMin,
          },
          author
        );
        placeId = result.id;
        if (!result.existed) await ctx.db.patch(result.id, { source: "ai_plan" });
      }
      const eventId = await insertEvent(
        ctx,
        trip,
        { title: item.title.slice(0, 120), emoji: EMOJI[kind], placeId, day, startTime: pad(item.time), durationMin: item.durationMin, participants: { type: "all" }, notes: item.why },
        author,
        { notify: false }
      );
      await ctx.db.patch(eventId, { source: "ai_plan" });
      added++;
    }
    return { removed, added };
  },
});


/** The poll best matching some words of its question, straight from the database (it may have been created a moment ago in the same reply). */
export const findPoll = internalQuery({
  args: { tripId: v.id("trips"), question: v.string() },
  handler: async (ctx, { tripId, question }) => {
    const needle = question.trim().toLowerCase();
    const polls = await ctx.db.query("polls").withIndex("by_trip", (q) => q.eq("tripId", tripId)).collect();
    const poll = polls.find((p) => p.question.toLowerCase() === needle) ?? polls.find((p) => p.question.toLowerCase().includes(needle) || needle.includes(p.question.toLowerCase()));
    return poll ? { id: poll._id as string, question: poll.question, closed: poll.closed, options: poll.options.map((o) => ({ id: o.id, label: o.label })) } : null;
  },
});

const nights = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/**
 * "We're staying at X from A to B": saves the stay with its nights, replaces any suggested hotel for those nights (and its
 * suggested check-in/out items), adds the check-in and check-out, and sets the home base when there is none.
 */
export const setStay = internalMutation({
  args: {
    tripId: v.id("trips"),
    name: v.string(),
    area: v.optional(v.string()),
    address: v.optional(v.string()),
    lat: v.union(v.number(), v.null()),
    lng: v.union(v.number(), v.null()),
    photoUrl: v.optional(v.string()),
    checkIn: v.string(),
    checkOut: v.string(),
    locale: v.string(),
    authorName: v.string(),
  },
  handler: async (ctx, args) => {
    const trip = await loadTrip(ctx, args.tripId);
    if (args.checkOut <= args.checkIn || !inRange(trip, args.checkIn)) fail("invalid", "stay_dates");
    const lang = isLocale(args.locale) ? args.locale : "en";
    const author = { name: args.authorName, aiName: trip.ai.name };
    const stay = await insertPlace(
      ctx,
      args.tripId,
      {
        name: args.name.slice(0, 120),
        category: "accommodation",
        ...(args.area ? { area: args.area } : {}),
        ...(args.address ? { address: args.address } : {}),
        lat: args.lat,
        lng: args.lng,
        ...(args.photoUrl ? { imageUrl: args.photoUrl } : {}),
      },
      author
    );
    await ctx.db.patch(stay.id, { stayFrom: args.checkIn, stayTo: args.checkOut, source: "manual" });

    // Suggested hotels for these nights give way
    let replaced = 0;
    for (const old of await ctx.db.query("places").withIndex("by_trip", (q) => q.eq("tripId", args.tripId)).collect()) {
      if (old._id === stay.id || old.source !== "ai_plan" || old.category !== "accommodation" || !old.stayFrom || !old.stayTo) continue;
      if (Math.min(nights(args.checkIn, old.stayTo), nights(old.stayFrom, args.checkOut)) <= 0) continue;
      for (const event of await ctx.db.query("events").withIndex("by_place", (q) => q.eq("placeId", old._id)).collect()) {
        if (event.source === "ai_plan" && (event.emoji === "hotel" || event.emoji === "luggage")) await dropEvent(ctx, event);
        else await ctx.db.patch(event._id, { placeId: stay.id });
      }
      await ctx.db.delete(old._id);
      replaced++;
    }
    for (const [day, time, key, emoji] of [
      [args.checkIn, "15:00", "server.booking.checkIn", "hotel"],
      [args.checkOut, "11:00", "server.booking.checkOut", "luggage"],
    ] as const) {
      if (!inRange(trip, day)) continue;
      const id = await insertEvent(ctx, trip, { title: `${translate(lang, key)} · ${args.name}`.slice(0, 120), emoji, placeId: stay.id, day, startTime: time, durationMin: null, participants: { type: "all" }, notes: "" }, author, { notify: false });
      await ctx.db.patch(id, { source: "manual" });
    }
    if (!trip.homeBase) await ctx.db.patch(args.tripId, { homeBase: { name: args.name, address: args.address ?? "", lat: args.lat, lng: args.lng } });
    return { placeId: stay.id, replaced };
  },
});
