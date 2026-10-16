import { v } from "convex/values";
import { internal } from "./_generated/api";
import { fail, isAdmin } from "./lib/authz";
import { tripMutation, tripQuery } from "./lib/functions";

/** Everyone in the trip (for avatars, members list, "who's coming"). */
export const list = tripQuery({
  args: {},
  handler: async (ctx) => {
    const members = await ctx.db
      .query("memberships")
      .withIndex("by_trip", (q) => q.eq("tripId", ctx.tripId))
      .collect();
    return members
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map(({ _id, userId, role, displayName, image, familyId, memberKey, guest, joinedAt }) => ({
        id: _id,
        userId,
        role,
        displayName,
        image,
        familyId,
        memberKey,
        guest,
        joinedAt,
        isMe: userId === ctx.user._id,
      }));
  },
});

/** Links the caller to a roster seat ("that's me" in a family). */
export const linkSeat = tripMutation({
  args: { familyId: v.id("families"), memberKey: v.string() },
  handler: async (ctx, { familyId, memberKey }) => {
    const family = await ctx.db.get(familyId);
    const member = family?.tripId === ctx.tripId ? family.members.find((m) => m.key === memberKey) : undefined;
    if (!family || !member) fail("invalid", "seat");
    await ctx.db.patch(ctx.member._id, { familyId, memberKey, displayName: member.name });
  },
});

export const setRole = tripMutation({
  args: { membershipId: v.id("memberships"), role: v.union(v.literal("admin"), v.literal("member"), v.literal("kid")) },
  handler: async (ctx, { membershipId, role }) => {
    if (!isAdmin(ctx.member)) fail("forbidden");
    const target = await ctx.db.get(membershipId);
    if (!target || target.tripId !== ctx.tripId) fail("not_found");
    if (target.role === "owner") fail("forbidden", "owner_role");
    await ctx.db.patch(membershipId, { role });
  },
});

/** An organizer removes someone; their personal data in the trip goes too. */
export const remove = tripMutation({
  args: { membershipId: v.id("memberships") },
  handler: async (ctx, { membershipId }) => {
    if (!isAdmin(ctx.member)) fail("forbidden");
    const target = await ctx.db.get(membershipId);
    if (!target || target.tripId !== ctx.tripId) fail("not_found");
    if (target.role === "owner") fail("forbidden", "owner_cannot_leave");
    await ctx.db.delete(membershipId);
    await ctx.scheduler.runAfter(0, internal.purge.userFromTrip, { tripId: ctx.tripId, userId: target.userId });
  },
});

/** Leave the trip and delete my data in it. The owner must hand over or delete instead. */
export const leave = tripMutation({
  args: {},
  handler: async (ctx) => {
    if (ctx.member.role === "owner") fail("forbidden", "owner_cannot_leave");
    await ctx.db.delete(ctx.member._id);
    await ctx.scheduler.runAfter(0, internal.purge.userFromTrip, { tripId: ctx.tripId, userId: ctx.user._id });
  },
});

/** Remember the last-opened trip so the app can reopen it. */
export const touch = tripMutation({
  args: {},
  handler: async (ctx) => {
    await ctx.db.patch(ctx.member._id, { lastOpenedAt: Date.now() });
  },
});
