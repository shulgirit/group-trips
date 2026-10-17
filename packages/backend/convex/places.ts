import { samePlaceName } from "@together/shared/place-name";
import { PlaceInputSchema } from "@together/shared/schemas";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation } from "./_generated/server";
import { canDeletePlace, fail } from "./lib/authz";
import { tripMutation, tripQuery } from "./lib/functions";
import { placeCategory } from "./lib/validators";

const placeFields = {
  name: v.string(),
  category: placeCategory,
  area: v.optional(v.string()),
  address: v.optional(v.string()),
  lat: v.optional(v.union(v.number(), v.null())),
  lng: v.optional(v.union(v.number(), v.null())),
  website: v.optional(v.string()),
  bookingUrl: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
  summary: v.optional(v.string()),
  openingHours: v.optional(v.string()),
  priceNotes: v.optional(v.string()),
  recommendedDurationMin: v.optional(v.union(v.number(), v.null())),
  tips: v.optional(v.string()),
  reviewsSummary: v.optional(v.string()),
  popularDishes: v.optional(v.string()),
  sourceUrl: v.optional(v.string()),
};
export const placeInput = v.object(placeFields);

export const list = tripQuery({
  args: {},
  handler: async (ctx) =>
    ctx.db
      .query("places")
      .withIndex("by_trip", (q) => q.eq("tripId", ctx.tripId))
      .collect(),
});

export const get = tripQuery({
  // A string: URLs may carry stale or migrated ids — unknown ones are just null
  args: { placeId: v.string() },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("places", args.placeId);
    const place = id ? await ctx.db.get(id) : null;
    return place && place.tripId === ctx.tripId ? place : null;
  },
});

/**
 * Adds a place, or returns the existing one with the same name — the group
 * never gets duplicates (shared rule with the AI tools and imports).
 */
export async function insertPlace(
  ctx: MutationCtx,
  tripId: Id<"trips">,
  input: unknown,
  author: { userId?: Id<"users">; name?: string }
): Promise<{ id: Id<"places">; existed: boolean }> {
  const parsed = PlaceInputSchema.safeParse(input);
  if (!parsed.success) fail("invalid", parsed.error.issues[0]?.message);
  const data = parsed.data;
  const existing = await ctx.db
    .query("places")
    .withIndex("by_trip", (q) => q.eq("tripId", tripId))
    .collect();
  const same = existing.find((place) => samePlaceName(place.name, data.name));
  if (same) return { id: same._id, existed: true };
  const id = await ctx.db.insert("places", {
    ...data,
    category: data.category as (typeof existing)[number]["category"],
    tripId,
    createdBy: author.userId,
    createdByName: author.name || undefined,
    createdAt: Date.now(),
  });
  if (!data.imageUrl) await ctx.scheduler.runAfter(0, internal.photos.ensurePlacePhoto, { placeId: id });
  return { id, existed: false };
}

export const add = tripMutation({
  args: { input: placeInput },
  handler: async (ctx, { input }) =>
    insertPlace(ctx, ctx.tripId, input, { userId: ctx.user._id, name: ctx.member.displayName }),
});

export const update = tripMutation({
  args: {
    placeId: v.id("places"),
    patch: v.object({ ...placeInput.partial().fields, favorite: v.optional(v.boolean()) }),
  },
  handler: async (ctx, { placeId, patch }) => {
    const place = await ctx.db.get(placeId);
    if (!place || place.tripId !== ctx.tripId) fail("not_found");
    await ctx.db.patch(placeId, patch);
  },
});

export const remove = tripMutation({
  args: { placeId: v.id("places") },
  handler: async (ctx, { placeId }) => {
    const place = await ctx.db.get(placeId);
    if (!place || place.tripId !== ctx.tripId) fail("not_found");
    if (!canDeletePlace(ctx)) fail("forbidden");
    // Events keep their slot; they just lose the link
    const linked = await ctx.db
      .query("events")
      .withIndex("by_place", (q) => q.eq("placeId", placeId))
      .collect();
    for (const event of linked) await ctx.db.patch(event._id, { placeId: null });
    await ctx.db.delete(placeId);
  },
});

/** Used by actions (imports, AI, photo backfill) that already resolved the place. */
export const patchInternal = internalMutation({
  args: {
    placeId: v.id("places"),
    patch: v.object({ ...placeInput.partial().fields, photoTriedAt: v.optional(v.number()) }),
  },
  handler: async (ctx, { placeId, patch }) => {
    if (await ctx.db.get(placeId)) await ctx.db.patch(placeId, patch);
  },
});
