import { contentLocale, isLocale } from "@together/i18n/config";
import { translate } from "@together/i18n/translate";
import { MAX_BOOKING_BYTES, planBooking, SUPPORTED_BOOKING_TYPES } from "@together/integrations/booking";
import { geocodePlace } from "@together/integrations/import-place";
import { samePlaceName } from "@together/shared/place-name";
import { type Infer, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { insertEvent, regionOf, scheduleReminder } from "./events";
import { fail, isAdult, requireMember } from "./lib/authz";
import { tripMutation, tripQuery } from "./lib/functions";
import { quotaLeft, recordUsage } from "./lib/limits";
import { bookingItem } from "./lib/validators";
import { insertPlace } from "./places";
import { shiftTripDates } from "./trips";

/**
 * Booking confirmations (PDF / image upload, or pasted email text):
 * fromFile/fromText queue an AI extraction, the review UI subscribes to
 * the import, and apply turns reviewed items into places and events.
 */

export const list = tripQuery({
  args: {},
  handler: async (ctx) =>
    ctx.db
      .query("imports")
      .withIndex("by_trip_creator", (q) => q.eq("tripId", ctx.tripId).eq("createdBy", ctx.user._id))
      .order("desc")
      .take(20),
});

export const get = tripQuery({
  args: { importId: v.id("imports") },
  handler: async (ctx, { importId }) => {
    const row = await ctx.db.get(importId);
    return row && row.tripId === ctx.tripId && row.createdBy === ctx.user._id ? row : null;
  },
});

const localeArg = { locale: v.optional(v.string()) };

export const fromFile = tripMutation({
  args: { storageId: v.id("_storage"), fileName: v.string(), ...localeArg },
  handler: async (ctx, { storageId, fileName, locale }) => {
    if (!isAdult(ctx.member)) fail("forbidden");
    const meta = await ctx.db.system.get(storageId);
    if (!meta) fail("invalid", "file");
    const contentType = meta.contentType ?? "";
    if (meta.size > MAX_BOOKING_BYTES) {
      await ctx.storage.delete(storageId);
      fail("limit", "too_large");
    }
    if (!SUPPORTED_BOOKING_TYPES.test(contentType)) {
      await ctx.storage.delete(storageId);
      fail("invalid", "unsupported_type");
    }
    if (!(await quotaLeft(ctx, ctx.tripId, "bookingImports"))) fail("limit", "quota_exceeded");
    const importId = await ctx.db.insert("imports", {
      tripId: ctx.tripId,
      createdBy: ctx.user._id,
      fileName: fileName.slice(0, 200),
      storageId,
      contentType,
      size: meta.size,
      status: "processing",
      items: [],
      createdAt: Date.now(),
    });
    await recordUsage(ctx, ctx.tripId, "bookingImports");
    await ctx.scheduler.runAfter(0, internal.importsRun.extract, { importId, locale: locale ?? ctx.user.locale ?? "he" });
    return importId;
  },
});

export const fromText = tripMutation({
  args: { text: v.string(), ...localeArg },
  handler: async (ctx, { text, locale }) => {
    if (!isAdult(ctx.member)) fail("forbidden");
    const body = text.trim();
    if (!body || body.length > 30_000) fail("invalid", "text");
    if (!(await quotaLeft(ctx, ctx.tripId, "bookingImports"))) fail("limit", "quota_exceeded");
    const lang = isLocale(locale) ? locale : "he";
    const importId = await ctx.db.insert("imports", {
      tripId: ctx.tripId,
      createdBy: ctx.user._id,
      fileName: translate(lang, "creator.booking.pastedLabel"),
      storageId: null,
      contentType: "text/plain",
      size: body.length,
      status: "processing",
      items: [],
      createdAt: Date.now(),
    });
    await recordUsage(ctx, ctx.tripId, "bookingImports");
    await ctx.scheduler.runAfter(0, internal.importsRun.extract, { importId, locale: lang, text: body });
    return importId;
  },
});

// ── apply ─────────────────────────────────────────────────────────────

export const applyAccess = internalQuery({
  args: { tripId: v.id("trips"), importId: v.id("imports") },
  handler: async (ctx, { tripId, importId }) => {
    const access = await requireMember(ctx, tripId);
    if (!isAdult(access.member)) fail("forbidden");
    const row = await ctx.db.get(importId);
    if (!row || row.tripId !== tripId || row.status === "applied") fail("not_found");
    const places = await ctx.db
      .query("places")
      .withIndex("by_trip", (q) => q.eq("tripId", tripId))
      .collect();
    return {
      region: regionOf(access.trip),
      signer: access.member.displayName,
      locale: access.user.locale,
      hasHomeBase: Boolean(access.trip.homeBase),
      placeNames: places.map((place) => place.name),
    };
  },
});

const geo = v.union(
  v.object({ lat: v.number(), lng: v.number(), address: v.optional(v.string()), photoUrl: v.optional(v.string()) }),
  v.null()
);


const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{1,2}:\d{2}$/;
const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/**
 * The date a tentative plan should start on, from reviewed bookings: the first hotel check-in, or the day the first
 * flight lands. Null when there is nothing dated (or it is implausibly far from the plan).
 */
export function anchorDate(
  items: { kind: string; startDate: string; endDate: string; from?: string; to?: string }[],
  trip: { startDate: string; stops: { label: string; region: string }[] }
): string | null {
  const places = trip.stops.flatMap((stop) => [stop.label, stop.region]).map((name) => name.trim().toLowerCase()).filter((name) => name.length > 2);
  const mentions = (text: string | undefined) => Boolean(text) && places.some((name) => text!.toLowerCase().includes(name));
  const stays = items.filter((item) => item.kind === "lodging" && DATE.test(item.startDate)).map((item) => item.startDate);
  // Only flights heading to the trip count; a flight home (from the destination) must not move the start
  const flights = items
    .filter((item) => item.kind === "flight" && DATE.test(item.startDate))
    .filter((item) => !(mentions(item.from) && !mentions(item.to)))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const landing = flights[0] ? (DATE.test(flights[0].endDate) ? flights[0].endDate : flights[0].startDate) : null;
  const first = [...stays, ...(landing ? [landing] : [])].sort()[0];
  return first && Math.abs(dayDiff(trip.startDate, first)) <= 500 ? first : null;
}

const summary = (events: number, places: number, homeBase: boolean) => ({ events, places, homeBase });

export interface ApplySummary {
  events: number;
  places: number;
  homeBase: boolean;
  datesMoved: { from: string; to: string } | null;
  staysReplaced: number;
  eventsReplaced: number;
  bookedEnd: string | null;
  trimmed: number;
  tripEnd: string;
}

export const applyPlan = internalMutation({
  args: {
    tripId: v.id("trips"),
    importId: v.id("imports"),
    items: v.array(bookingItem),
    geocodes: v.array(geo),
    locale: v.string(),
  },
  handler: async (ctx, { tripId, importId, items, geocodes, locale }) => {
    const access = await requireMember(ctx, tripId);
    const row = await ctx.db.get(importId);
    if (!row || row.tripId !== tripId || row.status === "applied") fail("not_found");
    const lang = isLocale(locale) ? locale : "he";
    const signer = access.member.displayName || translate(lang, "server.booking.importer");
    const labels = { checkIn: translate(lang, "server.booking.checkIn"), checkOut: translate(lang, "server.booking.checkOut") };
    let events = 0;
    let places = 0;
    let homeBase = false;
    const reshaped = { datesMoved: null as { from: string; to: string } | null, staysReplaced: 0, eventsReplaced: 0, bookedEnd: null as string | null, trimmed: 0 };

    // 1. A booking anchors an approximate (AI-planned) trip: shift everything so it starts on the real date
    let trip = access.trip;
    if (trip.datesApproximate) {
      const anchor = anchorDate(items, trip);
      if (anchor) {
        const from = trip.startDate;
        if (anchor !== from) {
          await shiftTripDates(ctx, tripId, anchor);
          reshaped.datesMoved = { from, to: anchor };
        }
        await ctx.db.patch(tripId, { datesApproximate: false, updatedAt: Date.now() });
        trip = (await ctx.db.get(tripId))!;
      }
    }

    // Flights cut the plan: nothing suggested can happen before you land or after you fly home
    if (trip.plannedFrom === "ai") {
      const stopNames = trip.stops.flatMap((stop) => [stop.label, stop.region]).map((n) => n.trim().toLowerCase()).filter((n) => n.length > 2);
      const mentions = (text: string) => Boolean(text) && stopNames.some((n) => text.toLowerCase().includes(n));
      const flights = items.filter((item) => item.kind === "flight" && DATE.test(item.startDate));
      const arriving = flights.filter((f) => !(mentions(f.from) && !mentions(f.to))).sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
      const leaving = flights.filter((f) => mentions(f.from) && !mentions(f.to)).sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
      const all = (await ctx.db.query("events").withIndex("by_trip_day", (q) => q.eq("tripId", tripId)).collect()).filter((event) => event.source === "ai_plan");
      const clock = (time: string) => (TIME.test(time) ? Number(time.split(":")[0]) * 60 + Number(time.split(":")[1]) : null);
      const drop = async (event: (typeof all)[number]) => {
        if (event.reminderJobId) await ctx.scheduler.cancel(event.reminderJobId);
        await ctx.db.delete(event._id);
        reshaped.trimmed++;
      };
      const landDay = arriving ? (DATE.test(arriving.endDate) ? arriving.endDate : arriving.startDate) : null;
      const landAt = arriving ? clock(arriving.endTime) : null;
      if (landDay && landAt !== null) {
        for (const event of all.filter((e) => e.day === landDay && (clock(e.startTime) ?? 0) < landAt + 120)) await drop(event);
      }
      if (leaving) {
        const leaveAt = clock(leaving.startTime);
        for (const event of all) {
          if (event.day > leaving.startDate || (event.day === leaving.startDate && leaveAt !== null && (clock(event.startTime) ?? 0) > leaveAt - 180)) {
            if (await ctx.db.get(event._id)) await drop(event);
          }
        }
        if (leaving.startDate < trip.endDate && leaving.startDate >= trip.startDate) {
          const stops = trip.stops.map((stop, i) => (i === trip.stops.length - 1 ? { ...stop, endDate: leaving.startDate > stop.startDate ? leaving.startDate : stop.startDate } : stop));
          await ctx.db.patch(tripId, { endDate: leaving.startDate, stops });
          trip = (await ctx.db.get(tripId))!;
        }
      }
    }

    // Where the bookings end (a flight counts by its departure), when that differs from the plan
    const ends = items.flatMap((item) => (item.kind === "flight" ? [item.startDate] : [item.endDate, item.startDate])).filter((d) => DATE.test(d)).sort();
    const lastBooked = ends[ends.length - 1];
    if (lastBooked && lastBooked !== trip.endDate && trip.plannedFrom === "ai") reshaped.bookedEnd = lastBooked;

    // 2. What the plan still holds as suggestions, to be replaced by the real thing
    const suggestedEvents = (await ctx.db.query("events").withIndex("by_trip_day", (q) => q.eq("tripId", tripId)).collect()).filter((event) => event.source === "ai_plan");
    const suggestedStays = (await ctx.db.query("places").withIndex("by_trip", (q) => q.eq("tripId", tripId)).collect()).filter(
      (place) => place.source === "ai_plan" && place.category === "accommodation"
    );
    const taken = new Set<Id<"events">>();
    const placeName = new Map<Id<"places">, string>();
    for (const place of await ctx.db.query("places").withIndex("by_trip", (q) => q.eq("tripId", tripId)).collect()) placeName.set(place._id, place.name);

    for (const [index, item] of items.entries()) {
      const plan = planBooking(item, labels);
      let placeId: Id<"places"> | null = null;
      if (plan.venue) {
        const g = geocodes[index] ?? null;
        const result = await insertPlace(
          ctx,
          tripId,
          {
            name: plan.venue.name,
            category: plan.venue.category,
            ...(plan.venue.area ? { area: plan.venue.area } : {}),
            ...(g?.address || plan.venue.address ? { address: g?.address ?? plan.venue.address } : {}),
            lat: g?.lat ?? null,
            lng: g?.lng ?? null,
            ...(g?.photoUrl ? { imageUrl: g.photoUrl } : {}),
            ...(plan.venue.tips ? { tips: plan.venue.tips } : {}),
          },
          { userId: access.user._id, name: signer }
        );
        placeId = result.id;
        placeName.set(result.id, plan.venue.name);
        if (!result.existed) {
          places++;
          await ctx.db.patch(result.id, {
            source: "booking",
            ...(plan.venue.stayFrom || plan.venue.stayTo ? { stayFrom: plan.venue.stayFrom, stayTo: plan.venue.stayTo } : {}),
          });
          // The first booked stay becomes the trip's home base
          if (plan.venue.lodging && !trip.homeBase && !homeBase) {
            await ctx.db.patch(tripId, {
              homeBase: { name: plan.venue.name, address: g?.address ?? plan.venue.address ?? "", lat: g?.lat ?? null, lng: g?.lng ?? null },
            });
            homeBase = true;
          }
        }
        // A booked hotel replaces the suggested stay with the most overlapping nights
        if (plan.venue.lodging && plan.venue.stayFrom && plan.venue.stayTo) {
          const [from, to] = [plan.venue.stayFrom, plan.venue.stayTo];
          let best: { stay: (typeof suggestedStays)[number]; overlap: number } | null = null;
          for (const stay of suggestedStays) {
            if (!stay.stayFrom || !stay.stayTo || stay._id === result.id) continue;
            const overlap = Math.min(dayDiff(from, stay.stayTo), dayDiff(stay.stayFrom, to), dayDiff(from, to), dayDiff(stay.stayFrom, stay.stayTo));
            if (overlap > 0 && (!best || overlap > best.overlap)) best = { stay, overlap };
          }
          if (best) {
            const old = best.stay;
            suggestedStays.splice(suggestedStays.indexOf(old), 1);
            for (const event of await ctx.db.query("events").withIndex("by_trip_day", (q) => q.eq("tripId", tripId)).collect()) {
              if (event.placeId !== old._id) continue;
              // The suggested check-in/out give way to the booking's own; anything else keeps its slot, now linked to the real hotel
              if (event.source === "ai_plan" && (event.emoji === "hotel" || event.emoji === "luggage")) {
                if (event.reminderJobId) await ctx.scheduler.cancel(event.reminderJobId);
                await ctx.db.delete(event._id);
                suggestedEvents.splice(suggestedEvents.findIndex((e) => e._id === event._id), 1);
              } else {
                await ctx.db.patch(event._id, { placeId: result.id });
              }
            }
            await ctx.db.delete(old._id);
            reshaped.staysReplaced++;
          }
        }
      }

      for (const event of plan.events) {
        // A ticket or reservation takes over the suggestion for the same place (same day first, then any day)
        const wanted = plan.venue?.name;
        const swap =
          item.kind === "activity" || item.kind === "restaurant"
            ? (() => {
                const sameVenue = suggestedEvents.filter((e) => !taken.has(e._id) && wanted && e.placeId && samePlaceName(placeName.get(e.placeId) ?? "", wanted));
                return sameVenue.find((e) => e.day === event.day) ?? sameVenue[0] ?? suggestedEvents.find((e) => !taken.has(e._id) && e.day === event.day && samePlaceName(e.title, event.title));
              })()
            : undefined;
        if (swap) {
          taken.add(swap._id);
          await ctx.db.patch(swap._id, {
            title: event.title,
            emoji: event.emoji,
            day: event.day,
            startTime: event.startTime,
            durationMin: event.durationMin ?? swap.durationMin,
            notes: event.notes || swap.notes,
            placeId: placeId ?? swap.placeId,
            source: "booking",
          });
          await scheduleReminder(ctx, trip, swap._id);
          reshaped.eventsReplaced++;
          events++;
          continue;
        }
        const eventId = await insertEvent(
          ctx,
          trip,
          { ...event, placeId, participants: { type: "all" } },
          { userId: access.user._id, name: signer },
          { notify: false }
        );
        await ctx.db.patch(eventId, { source: "booking" });
        events++;
      }
    }

    // Keep the original confirmation with the trip's shared documents
    if (row.storageId) {
      await ctx.db.insert("documents", {
        tripId,
        ownerId: access.user._id,
        ownerName: access.member.displayName,
        visibility: "shared",
        name: row.fileName,
        storageId: row.storageId,
        contentType: row.contentType,
        size: row.size,
        createdAt: Date.now(),
      });
    }
    await ctx.db.patch(importId, { status: "applied", items, appliedAt: Date.now() });
    return { ...summary(events, places, homeBase), ...reshaped, tripEnd: trip.endDate };
  },
});

/** Writes the reviewed items into the trip. An action: venues are geocoded first. */
export const apply = action({
  args: { tripId: v.id("trips"), importId: v.id("imports"), items: v.array(bookingItem) },
  handler: async (ctx, { tripId, importId, items }): Promise<ApplySummary> => {
    if (items.length > 30) fail("invalid", "too_many");
    const info = await ctx.runQuery(internal.imports.applyAccess, { tripId, importId });
    const lang = isLocale(info.locale) ? info.locale : "he";
    const labels = { checkIn: translate(lang, "server.booking.checkIn"), checkOut: translate(lang, "server.booking.checkOut") };
    const geocodes: Infer<typeof geo>[] = await Promise.all(
      items.map(async (item) => {
        const venue = planBooking(item, labels).venue;
        // Existing places keep their data; only new venues are looked up
        if (!venue || info.placeNames.some((name) => samePlaceName(name, venue.name))) return null;
        const found = await geocodePlace(venue.query, info.region).catch(() => null);
        return found
          ? { lat: found.lat, lng: found.lng, ...(found.address ? { address: found.address } : {}), ...(found.photoUrl ? { photoUrl: found.photoUrl } : {}) }
          : null;
      })
    );
    return ctx.runMutation(internal.imports.applyPlan, { tripId, importId, items, geocodes, locale: contentLocale(lang) });
  },
});
