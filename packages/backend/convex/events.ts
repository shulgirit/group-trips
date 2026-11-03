import { EventInputSchema } from "@together/shared/schemas";
import { wazeUrl } from "@together/shared/nav";
import { zonedTimeToUtc } from "@together/shared/time";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { fail } from "./lib/authz";
import { tripMutation, tripQuery } from "./lib/functions";
import { participants } from "./lib/validators";
import { notifyGroup } from "./push";

/** "In 45 min: …" — sent once, rescheduled when the event moves. */
export const REMINDER_LEAD_MIN = 45;

export const eventInput = v.object({
  title: v.string(),
  emoji: v.optional(v.string()),
  placeId: v.optional(v.union(v.id("places"), v.null())),
  day: v.string(),
  startTime: v.string(),
  durationMin: v.optional(v.union(v.number(), v.null())),
  participants,
  notes: v.optional(v.string()),
});

function validate(input: typeof eventInput.type) {
  const parsed = EventInputSchema.safeParse(input);
  if (!parsed.success) fail("invalid", parsed.error.issues[0]?.message);
  return parsed.data;
}

export const regionOf = (trip: Doc<"trips">) => trip.stops[0]?.region || trip.destination.region || trip.destination.label;

async function navUrlFor(ctx: MutationCtx, trip: Doc<"trips">, placeId: Id<"places"> | null) {
  const place = placeId ? await ctx.db.get(placeId) : null;
  if (!place || (place.lat == null && !place.address)) return undefined;
  return wazeUrl({ name: place.name, address: place.address, lat: place.lat ?? null, lng: place.lng ?? null }, regionOf(trip));
}

/** (Re)schedules the reminder job for an event's current slot. */
export async function scheduleReminder(ctx: MutationCtx, trip: Doc<"trips">, eventId: Id<"events">) {
  const event = await ctx.db.get(eventId);
  if (!event) return;
  if (event.reminderJobId) await ctx.scheduler.cancel(event.reminderJobId);
  // A tentative (AI-planned) trip stays quiet until its organizer publishes it
  if (trip.tentative) {
    await ctx.db.patch(eventId, { reminderJobId: undefined, reminderSentAt: undefined });
    return;
  }
  const start = zonedTimeToUtc(event.day, event.startTime, trip.timezone);
  const at = start === null ? null : start - REMINDER_LEAD_MIN * 60_000;
  // Too late to remind (or no valid time): no job
  if (at === null || at < Date.now() + 60_000) {
    await ctx.db.patch(eventId, { reminderJobId: undefined, reminderSentAt: undefined });
    return;
  }
  const jobId = await ctx.scheduler.runAt(at, internal.events.remind, { eventId, startTime: event.startTime, day: event.day });
  await ctx.db.patch(eventId, { reminderJobId: jobId, reminderSentAt: undefined });
}

export async function insertEvent(
  ctx: MutationCtx,
  trip: Doc<"trips">,
  input: typeof eventInput.type,
  author: { userId?: Id<"users">; name?: string; aiName?: string },
  options: { notify?: boolean } = {}
): Promise<Id<"events">> {
  const data = validate(input);
  const placeId = input.placeId ?? null;
  if (placeId) {
    const place = await ctx.db.get(placeId);
    if (!place || place.tripId !== trip._id) fail("invalid", "place");
  }
  const eventId = await ctx.db.insert("events", {
    tripId: trip._id,
    title: data.title,
    emoji: data.emoji,
    placeId,
    day: data.day,
    startTime: data.startTime,
    durationMin: data.durationMin ?? null,
    participants: input.participants,
    notes: data.notes,
    createdBy: author.userId,
    createdByName: author.name || undefined,
    createdAt: Date.now(),
  });
  await scheduleReminder(ctx, trip, eventId);
  // Booking imports add many events at once without pinging the group
  if (options.notify === false) return eventId;
  await notifyGroup(
    ctx,
    trip._id,
    {
      type: "event",
      title: data.title,
      detail: data.startTime,
      day: data.day,
      navUrl: await navUrlFor(ctx, trip, placeId),
      by: author.aiName,
    },
    { excludeUserId: author.userId }
  );
  return eventId;
}

export const list = tripQuery({
  args: { day: v.optional(v.string()) },
  handler: async (ctx, { day }) =>
    ctx.db
      .query("events")
      .withIndex("by_trip_day", (q) => (day ? q.eq("tripId", ctx.tripId).eq("day", day) : q.eq("tripId", ctx.tripId)))
      .collect(),
});

export const get = tripQuery({
  // A string: URLs may carry stale or migrated ids — unknown ones are just null
  args: { eventId: v.string() },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("events", args.eventId);
    const event = id ? await ctx.db.get(id) : null;
    return event && event.tripId === ctx.tripId ? event : null;
  },
});

export const add = tripMutation({
  args: { input: eventInput },
  handler: async (ctx, { input }) => {
    return insertEvent(ctx, ctx.trip, input, { userId: ctx.user._id, name: ctx.member.displayName });
  },
});

export const update = tripMutation({
  args: { eventId: v.id("events"), input: eventInput },
  handler: async (ctx, { eventId, input }) => {
    const event = await ctx.db.get(eventId);
    if (!event || event.tripId !== ctx.tripId) fail("not_found");
    const data = validate(input);
    await ctx.db.patch(eventId, {
      title: data.title,
      emoji: data.emoji,
      placeId: input.placeId ?? null,
      day: data.day,
      startTime: data.startTime,
      durationMin: data.durationMin ?? null,
      participants: input.participants,
      notes: data.notes ?? "",
    });
    // Time may have moved — remind again for the new slot
    await scheduleReminder(ctx, ctx.trip, eventId);
  },
});

export const remove = tripMutation({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const event = await ctx.db.get(eventId);
    if (!event || event.tripId !== ctx.tripId) fail("not_found");
    if (event.reminderJobId) await ctx.scheduler.cancel(event.reminderJobId);
    await ctx.db.delete(eventId);
  },
});

/** Scheduled REMINDER_LEAD_MIN before the start; no-op if the event moved. */
export const remind = internalMutation({
  args: { eventId: v.id("events"), day: v.string(), startTime: v.string() },
  handler: async (ctx, { eventId, day, startTime }) => {
    const event = await ctx.db.get(eventId);
    if (!event || event.reminderSentAt || event.day !== day || event.startTime !== startTime) return;
    const trip = await ctx.db.get(event.tripId);
    if (!trip || trip.status !== "active") return;
    await ctx.db.patch(eventId, { reminderSentAt: Date.now(), reminderJobId: undefined });
    await notifyGroup(ctx, trip._id, {
      type: "reminder",
      eventId,
      title: event.title,
      minutes: REMINDER_LEAD_MIN,
      detail: `${event.startTime}${event.notes ? ` · ${event.notes}` : ""}`,
      navUrl: await navUrlFor(ctx, trip, event.placeId),
    });
  },
});
