import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx, query } from "./_generated/server";
import { getUser } from "./lib/authz";
import { userMutation } from "./lib/functions";

/** The signed-in user's profile (null when signed out). */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await getUser(ctx);
    if (!user) return null;
    return { id: user._id, name: user.name, email: user.email, image: user.image, guest: user.guest, locale: user.locale };
  },
});

export const setLocale = userMutation({
  args: { locale: v.string() },
  handler: async (ctx, { locale }) => {
    await ctx.db.patch(ctx.user._id, { locale: locale.slice(0, 8), updatedAt: Date.now() });
  },
});

async function userByAuthId(ctx: MutationCtx, authId: string) {
  return ctx.db
    .query("users")
    .withIndex("by_authId", (q) => q.eq("authId", authId))
    .unique();
}

/**
 * A guest device signed in for real (anonymous → Google/Apple/email): move
 * its trip seats to the real account. Called from Better Auth's
 * anonymous.onLinkAccount before the anonymous user is deleted.
 */
export const mergeGuest = internalMutation({
  args: { fromAuthId: v.string(), toAuthId: v.string() },
  handler: async (ctx, { fromAuthId, toAuthId }) => {
    const [from, to] = await Promise.all([userByAuthId(ctx, fromAuthId), userByAuthId(ctx, toAuthId)]);
    if (!from || !to || from._id === to._id) return;
    const seats = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", from._id))
      .collect();
    for (const seat of seats) {
      const already = await ctx.db
        .query("memberships")
        .withIndex("by_trip_user", (q) => q.eq("tripId", seat.tripId).eq("userId", to._id))
        .unique();
      if (already) {
        await ctx.db.delete(seat._id);
        continue;
      }
      await ctx.db.patch(seat._id, { userId: to._id, guest: false, image: to.image ?? seat.image });
      await reassignAuthored(ctx, seat.tripId, from._id, to._id);
    }
  },
});

/** Moves votes, chats, documents and authorship from one user to another inside a trip. */
async function reassignAuthored(ctx: MutationCtx, tripId: Id<"trips">, from: Id<"users">, to: Id<"users">) {
  const votes = await ctx.db
    .query("pollVotes")
    .withIndex("by_trip_user", (q) => q.eq("tripId", tripId).eq("userId", from))
    .collect();
  for (const vote of votes) await ctx.db.patch(vote._id, { userId: to });
  const chats = await ctx.db
    .query("chatSessions")
    .withIndex("by_trip_owner", (q) => q.eq("tripId", tripId).eq("ownerId", from))
    .collect();
  for (const chat of chats) await ctx.db.patch(chat._id, { ownerId: to });
  const docs = await ctx.db
    .query("documents")
    .withIndex("by_trip_owner", (q) => q.eq("tripId", tripId).eq("ownerId", from))
    .collect();
  for (const doc of docs) await ctx.db.patch(doc._id, { ownerId: to });
  for (const table of ["places", "events"] as const) {
    const rows = await ctx.db
      .query(table)
      .withIndex("by_creator", (q) => q.eq("createdBy", from))
      .collect();
    for (const row of rows) await ctx.db.patch(row._id, { createdBy: to });
  }
}

/**
 * Better Auth deleteUser.beforeDelete: trips the person owns pass to the
 * earliest admin, else the earliest adult account; trips nobody else is in
 * are deleted. Then their data leaves every trip.
 */
export const purgeForAuthUser = internalMutation({
  args: { authId: v.string() },
  handler: async (ctx, { authId }) => {
    const user = await userByAuthId(ctx, authId);
    if (!user) return;
    const seats = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const seat of seats) {
      const trip = await ctx.db.get(seat.tripId);
      if (trip && trip.ownerId === user._id) {
        const next = await successor(ctx, trip, user._id);
        if (!next) {
          await ctx.db.patch(trip._id, { status: "archived", updatedAt: Date.now() });
          await ctx.scheduler.runAfter(0, internal.purge.tripStep, { tripId: trip._id });
        } else {
          await ctx.db.patch(trip._id, { ownerId: next.userId, updatedAt: Date.now() });
          await ctx.db.patch(next._id, { role: "owner" });
        }
      }
      await ctx.db.delete(seat._id);
      await ctx.scheduler.runAfter(0, internal.purge.userFromTrip, { tripId: seat.tripId, userId: user._id });
    }
  },
});

async function successor(ctx: MutationCtx, trip: Doc<"trips">, ownerId: Id<"users">) {
  const members = await ctx.db
    .query("memberships")
    .withIndex("by_trip", (q) => q.eq("tripId", trip._id))
    .collect();
  const rank = (role: string) => (role === "admin" ? 0 : 1);
  return (
    members
      .filter((m) => m.userId !== ownerId && m.role !== "kid" && !m.guest)
      .sort((a, b) => rank(a.role) - rank(b.role) || a.joinedAt - b.joinedAt)[0] ?? null
  );
}
