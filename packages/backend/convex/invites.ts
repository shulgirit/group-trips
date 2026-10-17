import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { type QueryCtx, query } from "./_generated/server";
import { fail, isAdmin } from "./lib/authz";
import { tripMutation, tripQuery, userMutation } from "./lib/functions";
import { FREE_LIMITS, memberCount } from "./lib/limits";
import { inviteRole } from "./lib/validators";
import { createInvite } from "./trips";

const CODE = /^[a-z0-9]{6,16}$/;

type Lookup =
  | { ok: true; invite: Doc<"invites">; trip: Doc<"trips"> }
  | { ok: false; error: "not_found" | "expired" | "used_up" | "revoked" | "trip_closed" };

async function lookup(ctx: QueryCtx, code: string): Promise<Lookup> {
  if (!CODE.test(code)) return { ok: false, error: "not_found" };
  const invite = await ctx.db
    .query("invites")
    .withIndex("by_code", (q) => q.eq("code", code))
    .unique();
  if (!invite) return { ok: false, error: "not_found" };
  if (invite.revoked) return { ok: false, error: "revoked" };
  if (invite.expiresAt < Date.now()) return { ok: false, error: "expired" };
  if (invite.uses >= invite.maxUses) return { ok: false, error: "used_up" };
  const trip = await ctx.db.get(invite.tripId);
  if (!trip || trip.status === "archived") return { ok: false, error: "trip_closed" };
  return { ok: true, invite, trip };
}

/**
 * Public, non-sensitive slice for the invite page (shown before sign-in).
 * Includes the roster of the invite's family (or all families) so the
 * joiner can pick their own name.
 */
export const preview = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const found = await lookup(ctx, code);
    if (!found.ok) return { ok: false as const, error: found.error };
    const { invite, trip } = found;
    const [owner, families, members] = await Promise.all([
      ctx.db.get(trip.ownerId),
      ctx.db
        .query("families")
        .withIndex("by_trip", (q) => q.eq("tripId", trip._id))
        .collect(),
      ctx.db
        .query("memberships")
        .withIndex("by_trip", (q) => q.eq("tripId", trip._id))
        .take(FREE_LIMITS.membersPerTrip),
    ]);
    const taken = new Set(members.map((member) => member.memberKey).filter(Boolean));
    const shown = invite.familyId ? families.filter((family) => family._id === invite.familyId) : families;
    return {
      ok: true as const,
      role: invite.role,
      trip: {
        name: trip.name,
        emoji: trip.emoji,
        destination: trip.destination.label,
        startDate: trip.startDate,
        endDate: trip.endDate,
        coverImage: trip.coverImage,
        groupName: trip.groupName,
        ai: {
          name: trip.ai.name,
          emoji: trip.ai.emoji,
          // "bot:<id>" or the uploaded image's URL — ready to display
          avatar:
            trip.ai.avatar?.kind === "bot"
              ? `bot:${trip.ai.avatar.id}`
              : trip.ai.avatar?.kind === "file"
                ? await ctx.storage.getUrl(trip.ai.avatar.storageId)
                : null,
        },
        organizer: owner?.name ?? "",
        memberCount: members.length,
      },
      familyName: invite.familyId ? (families.find((f) => f._id === invite.familyId)?.name ?? null) : null,
      families: shown.map((family) => ({
        id: family._id,
        name: family.name,
        color: family.color,
        members: family.members.map((member) => ({
          key: member.key,
          name: member.name,
          kid: Boolean(member.kid),
          taken: taken.has(member.key),
        })),
      })),
    };
  },
});

/** Joins the caller to the invite's trip, optionally as a chosen roster member. */
export const redeem = userMutation({
  args: {
    code: v.string(),
    familyId: v.optional(v.union(v.id("families"), v.null())),
    memberKey: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const found = await lookup(ctx, args.code);
    if (!found.ok) fail("not_found", found.error);
    const { invite, trip } = found;
    const { user } = ctx;

    // Guest devices (kids, no account) can't take organizer seats
    if (user.guest && invite.role === "admin") fail("sign_in_required");

    const existing = await ctx.db
      .query("memberships")
      .withIndex("by_trip_user", (q) => q.eq("tripId", trip._id).eq("userId", user._id))
      .unique();
    if (!existing && (await memberCount(ctx, trip._id)) >= FREE_LIMITS.membersPerTrip) fail("limit", "trip_full");

    // Validate the picked identity against the roster
    let familyId = args.familyId ?? invite.familyId ?? null;
    let memberKey = args.memberKey ?? null;
    let memberName = "";
    const family = familyId ? await ctx.db.get(familyId) : null;
    if (!family || family.tripId !== trip._id) {
      familyId = null;
      memberKey = null;
    } else if (memberKey) {
      const member = family.members.find((m) => m.key === memberKey);
      if (member) memberName = member.name;
      else memberKey = null;
    }

    // A parent opening a kid-device link on their own account stays an adult
    const role = invite.role === "kid" && !user.guest ? "member" : invite.role;
    const seat = {
      displayName: memberName || user.name || "",
      image: user.image,
      familyId,
      memberKey,
      guest: user.guest,
    };
    if (existing) {
      // Never downgrade an owner/admin through a fresh invite
      await ctx.db.patch(existing._id, { ...seat, role: isAdmin(existing) ? existing.role : role });
    } else {
      await ctx.db.insert("memberships", { tripId: trip._id, userId: user._id, role, joinedAt: Date.now(), ...seat });
      await ctx.db.patch(invite._id, { uses: invite.uses + 1 });
    }
    return trip._id;
  },
});

/** Live invites of a trip (organizers). */
export const list = tripQuery({
  args: {},
  handler: async (ctx) => {
    if (!isAdmin(ctx.member)) fail("forbidden");
    const now = Date.now();
    const invites = await ctx.db
      .query("invites")
      .withIndex("by_trip", (q) => q.eq("tripId", ctx.tripId))
      .collect();
    return invites
      .filter((invite) => !invite.revoked && invite.expiresAt > now && invite.uses < invite.maxUses)
      .sort((a, b) => a.createdAt - b.createdAt)
      .map(({ code, role, familyId, uses, maxUses, expiresAt }) => ({ code, role, familyId, uses, maxUses, expiresAt }));
  },
});

export const create = tripMutation({
  args: {
    role: v.optional(inviteRole),
    familyId: v.optional(v.union(v.id("families"), v.null())),
    days: v.optional(v.number()),
    maxUses: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!isAdmin(ctx.member)) fail("forbidden");
    const role = args.role ?? "member";
    const days = Math.min(90, Math.max(1, Math.round(args.days ?? 30)));
    const maxUses = role === "kid" ? 3 : Math.min(100, Math.max(1, Math.round(args.maxUses ?? 40)));
    if (args.familyId) {
      const family = await ctx.db.get(args.familyId);
      if (!family || family.tripId !== ctx.tripId) fail("invalid", "family");
    }
    return createInvite(ctx, ctx.tripId, ctx.user._id, { role, familyId: args.familyId ?? null, days, maxUses });
  },
});

export const revoke = tripMutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    if (!isAdmin(ctx.member)) fail("forbidden");
    const invite = await ctx.db
      .query("invites")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
    if (!invite || invite.tripId !== ctx.tripId) fail("not_found");
    await ctx.db.patch(invite._id, { revoked: true });
  },
});
