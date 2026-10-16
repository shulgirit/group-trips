import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { fail } from "./lib/authz";
import { tripMutation, tripQuery } from "./lib/functions";

/** How long one share lasts: 1h, 3h, until the end of the day (client picks). */
const MAX_SHARE_MS = 24 * 60 * 60 * 1000;

/** Live locations of everyone currently sharing (not expired). */
export const list = tripQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const rows = await ctx.db
      .query("locations")
      .withIndex("by_trip_user", (q) => q.eq("tripId", ctx.tripId))
      .collect();
    return rows
      .filter((row) => row.expiresAt > now)
      .map(({ userId, name, familyId, lat, lng, accuracy, updatedAt, expiresAt }) => ({
        userId,
        name,
        familyId,
        lat,
        lng,
        accuracy,
        updatedAt,
        expiresAt,
        isMe: userId === ctx.user._id,
      }));
  },
});

export const share = tripMutation({
  args: { lat: v.number(), lng: v.number(), accuracy: v.optional(v.number()), expiresAt: v.number() },
  handler: async (ctx, { lat, lng, accuracy, expiresAt }) => {
    const now = Date.now();
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) fail("invalid", "coords");
    const until = Math.min(expiresAt, now + MAX_SHARE_MS);
    if (until <= now) fail("invalid", "expired");
    const existing = await ctx.db
      .query("locations")
      .withIndex("by_trip_user", (q) => q.eq("tripId", ctx.tripId).eq("userId", ctx.user._id))
      .unique();
    const row = {
      name: ctx.member.displayName || ctx.user.name,
      familyId: ctx.member.familyId,
      lat,
      lng,
      accuracy,
      updatedAt: now,
      expiresAt: until,
    };
    if (existing) await ctx.db.patch(existing._id, row);
    else await ctx.db.insert("locations", { tripId: ctx.tripId, userId: ctx.user._id, ...row });
  },
});

export const stop = tripMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("locations")
      .withIndex("by_trip_user", (q) => q.eq("tripId", ctx.tripId).eq("userId", ctx.user._id))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});

/** Cron: shared locations are deleted as soon as their window ends. */
export const deleteExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const expired = await ctx.db
      .query("locations")
      .withIndex("by_expires", (q) => q.lt("expiresAt", Date.now()))
      .take(500);
    for (const row of expired) await ctx.db.delete(row._id);
  },
});
