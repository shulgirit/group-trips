import { geocodePlace } from "@together/integrations/import-place";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { tripMutation } from "./lib/functions";
import { regionOf } from "./events";

/** Misses are remembered for a week so we don't pay Google to ask again. */
const RETRY_MS = 7 * 24 * 60 * 60 * 1000;

export const tripForCover = internalQuery({
  args: { tripId: v.id("trips") },
  handler: async (ctx, { tripId }) => ctx.db.get(tripId),
});

export const setTripCover = internalMutation({
  args: { tripId: v.id("trips"), coverImage: v.union(v.string(), v.null()) },
  handler: async (ctx, { tripId, coverImage }) => {
    const trip = await ctx.db.get(tripId);
    if (!trip || trip.coverImage) return;
    await ctx.db.patch(tripId, coverImage ? { coverImage } : { coverTriedAt: Date.now() });
  },
});

/** A trip without a cover gets its first stop's Google Places photo, once. */
export const ensureTripCover = internalAction({
  args: { tripId: v.id("trips") },
  handler: async (ctx, { tripId }) => {
    const trip = await ctx.runQuery(internal.photos.tripForCover, { tripId });
    if (!trip || trip.coverImage) return;
    if (trip.coverTriedAt && Date.now() - trip.coverTriedAt < RETRY_MS) return;
    const geo = await geocodePlace(trip.stops[0]?.label ?? trip.name, "");
    await ctx.runMutation(internal.photos.setTripCover, { tripId, coverImage: geo?.photoUrl ?? null });
  },
});

export const placeForPhoto = internalQuery({
  args: { placeId: v.id("places") },
  handler: async (ctx, { placeId }) => {
    const place = await ctx.db.get(placeId);
    const trip = place ? await ctx.db.get(place.tripId) : null;
    return place && trip ? { place, region: regionOf(trip) } : null;
  },
});

/** A saved place without an image gets a real photo (and coords) once. */
export const ensurePlacePhoto = internalAction({
  args: { placeId: v.id("places") },
  handler: async (ctx, { placeId }) => {
    const found = await ctx.runQuery(internal.photos.placeForPhoto, { placeId });
    if (!found || found.place.imageUrl) return;
    const { place, region } = found;
    if (place.photoTriedAt && Date.now() - place.photoTriedAt < RETRY_MS) return;
    const geo = await geocodePlace([place.name, place.area].filter(Boolean).join(" "), region);
    await ctx.runMutation(internal.places.patchInternal, {
      placeId,
      patch: {
        photoTriedAt: Date.now(),
        ...(geo?.photoUrl ? { imageUrl: geo.photoUrl } : {}),
        ...(geo && place.lat == null ? { lat: geo.lat, lng: geo.lng } : {}),
      },
    });
  },
});

/** Clients ask for backfill of older places/covers they display. */
export const request = tripMutation({
  args: { placeId: v.optional(v.id("places")) },
  handler: async (ctx, { placeId }) => {
    if (placeId) {
      const place = await ctx.db.get(placeId);
      if (place?.tripId === ctx.tripId && !place.imageUrl) {
        await ctx.scheduler.runAfter(0, internal.photos.ensurePlacePhoto, { placeId });
      }
    } else if (!ctx.trip.coverImage) {
      await ctx.scheduler.runAfter(0, internal.photos.ensureTripCover, { tripId: ctx.tripId });
    }
  },
});
