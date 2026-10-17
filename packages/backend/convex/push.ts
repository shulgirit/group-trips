import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import { tripMutation, userMutation } from "./lib/functions";
import { fail } from "./lib/authz";
import type { Notice } from "./lib/notices";

/**
 * Group notifications. Mutations call `notifyGroup` once per action; the
 * Node action in pushSend.ts renders each recipient's language and
 * delivers (web push now, Expo push for the native app).
 */
export async function notifyGroup(
  ctx: MutationCtx,
  tripId: Id<"trips">,
  item: Notice,
  options: { excludeUserId?: Id<"users"> } = {}
) {
  await ctx.scheduler.runAfter(0, internal.pushSend.toTrip, {
    tripId,
    notice: item,
    excludeUserId: options.excludeUserId,
  });
}

/** Browser subscribes (web app during the transition). */
export const subscribeWeb = tripMutation({
  args: { endpoint: v.string(), p256dh: v.string(), auth: v.string(), locale: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("webPushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .collect();
    for (const row of existing) if (row.tripId === ctx.tripId) await ctx.db.delete(row._id);
    await ctx.db.insert("webPushSubscriptions", {
      tripId: ctx.tripId,
      userId: ctx.user._id,
      endpoint: args.endpoint,
      p256dh: args.p256dh,
      auth: args.auth,
      locale: args.locale,
      createdAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.pushSend.toEndpoint, {
      tripId: ctx.tripId,
      endpoint: args.endpoint,
      notice: { type: "welcome" },
    });
  },
});

export const unsubscribeWeb = tripMutation({
  args: { endpoint: v.string() },
  handler: async (ctx, { endpoint }) => {
    const rows = await ctx.db
      .query("webPushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", endpoint))
      .collect();
    for (const row of rows) if (row.tripId === ctx.tripId && row.userId === ctx.user._id) await ctx.db.delete(row._id);
  },
});

const EXPO_TOKEN = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,100}\]$/;

/**
 * The native app registers its Expo push token after sign-in (and on
 * launch). A device belongs to whoever is signed in on it now.
 */
export const registerApp = userMutation({
  args: { token: v.string(), platform: v.union(v.literal("ios"), v.literal("android")), locale: v.string() },
  handler: async (ctx, { token, platform, locale }) => {
    if (!EXPO_TOKEN.test(token)) fail("invalid", "token");
    const now = Date.now();
    const existing = await ctx.db
      .query("appPushTokens")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    const fields = { userId: ctx.user._id, platform, locale: locale.slice(0, 8), updatedAt: now };
    if (existing) await ctx.db.patch(existing._id, fields);
    else await ctx.db.insert("appPushTokens", { token, createdAt: now, ...fields });
  },
});

/** Sign-out on a device: stop delivering to it. */
export const unregisterApp = userMutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const row = await ctx.db
      .query("appPushTokens")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (row && row.userId === ctx.user._id) await ctx.db.delete(row._id);
  },
});

/** App devices of everyone in the trip (except the actor). */
export const appTokens = internalQuery({
  args: { tripId: v.id("trips"), excludeUserId: v.optional(v.id("users")) },
  handler: async (ctx, { tripId, excludeUserId }) => {
    const seats = await ctx.db
      .query("memberships")
      .withIndex("by_trip", (q) => q.eq("tripId", tripId))
      .collect();
    const userIds = seats.map((seat) => seat.userId).filter((id) => id !== excludeUserId);
    const rows = await Promise.all(
      userIds.map((userId) =>
        ctx.db
          .query("appPushTokens")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .collect()
      )
    );
    return rows.flat().map(({ _id, token, locale }) => ({ _id, token, locale }));
  },
});

export const dropAppTokens = internalMutation({
  args: { ids: v.array(v.id("appPushTokens")) },
  handler: async (ctx, { ids }) => {
    for (const id of ids) if (await ctx.db.get(id)) await ctx.db.delete(id);
  },
});

export const subscriptions = internalQuery({
  args: { tripId: v.id("trips"), excludeUserId: v.optional(v.id("users")), endpoint: v.optional(v.string()) },
  handler: async (ctx, { tripId, excludeUserId, endpoint }) => {
    const rows = await ctx.db
      .query("webPushSubscriptions")
      .withIndex("by_trip", (q) => q.eq("tripId", tripId))
      .collect();
    return rows.filter((row) => row.userId !== excludeUserId && (!endpoint || row.endpoint === endpoint));
  },
});

export const dropSubscriptions = internalMutation({
  args: { ids: v.array(v.id("webPushSubscriptions")) },
  handler: async (ctx, { ids }) => {
    for (const id of ids) if (await ctx.db.get(id)) await ctx.db.delete(id);
  },
});
