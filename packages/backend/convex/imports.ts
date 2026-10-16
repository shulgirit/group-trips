import { contentLocale, isLocale } from "@together/i18n/config";
import { translate } from "@together/i18n/translate";
import { MAX_BOOKING_BYTES, planBooking, SUPPORTED_BOOKING_TYPES } from "@together/integrations/booking";
import { geocodePlace } from "@together/integrations/import-place";
import { samePlaceName } from "@together/shared/place-name";
import { type Infer, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { insertEvent, regionOf } from "./events";
import { fail, isAdult, requireMember } from "./lib/authz";
import { tripMutation, tripQuery } from "./lib/functions";
import { quotaLeft, recordUsage } from "./lib/limits";
import { bookingItem } from "./lib/validators";
import { insertPlace } from "./places";

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
        if (!result.existed) {
          places++;
          if (plan.venue.stayFrom || plan.venue.stayTo) {
            await ctx.db.patch(result.id, { stayFrom: plan.venue.stayFrom, stayTo: plan.venue.stayTo });
          }
          // The first booked stay becomes the trip's home base
          if (plan.venue.lodging && !access.trip.homeBase && !homeBase) {
            await ctx.db.patch(tripId, {
              homeBase: { name: plan.venue.name, address: g?.address ?? plan.venue.address ?? "", lat: g?.lat ?? null, lng: g?.lng ?? null },
            });
            homeBase = true;
          }
        }
      }
      for (const event of plan.events) {
        await insertEvent(
          ctx,
          access.trip,
          { ...event, placeId, participants: { type: "all" } },
          { userId: access.user._id, name: signer },
          { notify: false }
        );
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
    return { events, places, homeBase };
  },
});

/** Writes the reviewed items into the trip. An action: venues are geocoded first. */
export const apply = action({
  args: { tripId: v.id("trips"), importId: v.id("imports"), items: v.array(bookingItem) },
  handler: async (ctx, { tripId, importId, items }): Promise<{ events: number; places: number; homeBase: boolean }> => {
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
