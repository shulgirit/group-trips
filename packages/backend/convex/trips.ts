import { FAMILY_COLORS, randomId } from "@together/shared/trip-doc";
import { TripInputSchema } from "@together/shared/trip-schemas";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, query } from "./_generated/server";
import { fail, getUser, isAdmin } from "./lib/authz";
import { accountMutation, tripMutation, tripQuery, userQuery } from "./lib/functions";
import { activeTripCount, FREE_LIMITS } from "./lib/limits";
import { tripInput } from "./lib/validators";

type TripInput = Infer<typeof tripInput>;

/** Business rules live in the shared zod schema (lengths, stop order, ≤120 days). */
function validateInput(input: TripInput) {
  const avatar = input.ai.avatar?.kind === "bot" ? `bot:${input.ai.avatar.id}` : null;
  const parsed = TripInputSchema.safeParse({ ...input, ai: { ...input.ai, avatar } });
  if (!parsed.success) fail("invalid", parsed.error.issues[0]?.message);
}

function tripFields(input: TripInput) {
  const first = input.stops[0];
  const last = input.stops[input.stops.length - 1];
  return {
    name: input.name.trim(),
    emoji: input.emoji,
    stops: input.stops,
    destination: {
      label: first.label,
      ...(first.placeId ? { placeId: first.placeId } : {}),
      lat: first.lat,
      lng: first.lng,
      region: first.region,
      ...(first.country ? { country: first.country } : {}),
    },
    startDate: first.startDate,
    endDate: last.endDate,
    timezone: first.timezone,
    currency: first.currency,
    coverImage: first.coverImage,
    departureAt: input.departureAt ?? null,
    departureNote: input.departureNote ?? "",
    ...(input.currencies?.length ? { currencies: input.currencies } : {}),
    homeBase: input.homeBase,
    groupKind: input.groupKind,
    groupName: input.groupName.trim(),
    aboutUs: input.aboutUs ?? "",
    ai: input.ai,
  };
}

/**
 * Upserts families by their client key. Removing a family only while the
 * trip is a draft — once live, expenses and events may reference it.
 */
async function writeFamilies(
  ctx: MutationCtx,
  tripId: Id<"trips">,
  families: TripInput["families"],
  { allowDelete }: { allowDelete: boolean }
): Promise<Map<string, Id<"families">>> {
  const existing = await ctx.db
    .query("families")
    .withIndex("by_trip", (q) => q.eq("tripId", tripId))
    .collect();
  const byKey = new Map(existing.map((family) => [family.key, family]));
  const ids = new Map<string, Id<"families">>();

  for (const [index, family] of families.entries()) {
    const fields = {
      name: family.name.trim(),
      color: FAMILY_COLORS[index % FAMILY_COLORS.length],
      order: index,
      members: family.members.map((member) => ({
        key: member.id,
        name: member.name.trim(),
        ...(member.kid ? { kid: true } : {}),
        ...(member.age != null ? { age: member.age } : {}),
      })),
    };
    const current = byKey.get(family.id);
    if (current) {
      await ctx.db.patch(current._id, fields);
      ids.set(family.id, current._id);
    } else {
      ids.set(family.id, await ctx.db.insert("families", { tripId, key: family.id, ...fields }));
    }
  }
  if (allowDelete) {
    const keep = new Set(families.map((family) => family.id));
    for (const family of existing) if (!keep.has(family.key)) await ctx.db.delete(family._id);
  }
  return ids;
}

export async function createInvite(
  ctx: MutationCtx,
  tripId: Id<"trips">,
  createdBy: Id<"users">,
  options: { role: Doc<"invites">["role"]; familyId: Id<"families"> | null; days: number; maxUses: number }
): Promise<string> {
  const now = Date.now();
  let code = randomId(8);
  // Codes are unguessable; a collision is astronomically rare but cheap to rule out
  while (await ctx.db.query("invites").withIndex("by_code", (q) => q.eq("code", code)).unique()) code = randomId(8);
  await ctx.db.insert("invites", {
    code,
    tripId,
    role: options.role,
    familyId: options.familyId,
    createdBy,
    expiresAt: now + options.days * 86_400_000,
    maxUses: options.maxUses,
    uses: 0,
    revoked: false,
    createdAt: now,
  });
  return code;
}

/** The ready-made links shown after launch: one general, one per family. */
async function createDefaultInvites(
  ctx: MutationCtx,
  tripId: Id<"trips">,
  ownerId: Id<"users">,
  families: TripInput["families"],
  familyIds: Map<string, Id<"families">>
) {
  await createInvite(ctx, tripId, ownerId, { role: "member", familyId: null, days: 60, maxUses: 60 });
  for (const family of families) {
    await createInvite(ctx, tripId, ownerId, {
      role: "member",
      familyId: familyIds.get(family.id) ?? null,
      days: 60,
      maxUses: Math.max(4, family.members.length + 2),
    });
  }
}

/** Creates a trip (draft or active); the caller becomes its owner. */
export const create = accountMutation({
  args: { input: tripInput },
  handler: async (ctx, { input }) => {
  const { user } = ctx;
  validateInput(input);
  if ((await activeTripCount(ctx, user._id)) >= FREE_LIMITS.activeTripsPerUser) fail("limit", "trip_limit");

  const now = Date.now();
  const tripId = await ctx.db.insert("trips", {
    ...tripFields(input),
    membersCanDeletePlaces: true,
    status: input.status,
    ownerId: user._id,
    plan: "free",
    createdAt: now,
    updatedAt: now,
  });
  const familyIds = await writeFamilies(ctx, tripId, input.families, { allowDelete: false });
  await ctx.db.insert("memberships", {
    tripId,
    userId: user._id,
    role: "owner",
    displayName: user.name,
    image: user.image,
    familyId: input.me ? (familyIds.get(input.me.familyId) ?? null) : null,
    memberKey: input.me?.memberId ?? null,
    guest: false,
    joinedAt: now,
  });
  if (input.status === "active") await createDefaultInvites(ctx, tripId, user._id, input.families, familyIds);
  await ctx.scheduler.runAfter(0, internal.photos.ensureTripCover, { tripId });
  return tripId;
  },
});

/** Organizer edits (wizard autosave, settings). A live trip never returns to draft. */
export const update = tripMutation({
  args: { input: tripInput },
  handler: async (ctx, { input }) => {
    if (!isAdmin(ctx.member)) fail("forbidden");
    validateInput(input);
    const wasDraft = ctx.trip.status === "draft";
    const status = wasDraft ? input.status : ctx.trip.status;
    await ctx.db.patch(ctx.tripId, { ...tripFields(input), status, updatedAt: Date.now() });
    const familyIds = await writeFamilies(ctx, ctx.tripId, input.families, { allowDelete: wasDraft });
    if (input.me) {
      await ctx.db.patch(ctx.member._id, {
        familyId: familyIds.get(input.me.familyId) ?? null,
        memberKey: input.me.memberId,
      });
    }
    if (wasDraft && status === "active") {
      await createDefaultInvites(ctx, ctx.tripId, ctx.user._id, input.families, familyIds);
    }
    return { status };
  },
});

/** The currencies offered when adding an expense (organizer only). */
export const setCurrencies = tripMutation({
  args: { currencies: v.array(v.string()) },
  handler: async (ctx, { currencies }) => {
    if (!isAdmin(ctx.member)) fail("forbidden");
    const clean = [...new Set(currencies.map((code) => code.trim().toUpperCase()))].filter((code) => /^[A-Z]{3}$/.test(code));
    if (clean.length < 1 || clean.length > 8) fail("invalid", "currencies");
    await ctx.db.patch(ctx.tripId, { currencies: clean, updatedAt: Date.now() });
  },
});

/** Free text the AI knows about the group — every member may edit it. */
export const setAboutUs = tripMutation({
  args: { aboutUs: v.string() },
  handler: async (ctx, { aboutUs }) => {
    if (aboutUs.length > 4000) fail("invalid", "about_too_long");
    await ctx.db.patch(ctx.tripId, { aboutUs, updatedAt: Date.now() });
  },
});

export const setSettings = tripMutation({
  args: { membersCanDeletePlaces: v.boolean() },
  handler: async (ctx, { membersCanDeletePlaces }) => {
    if (!isAdmin(ctx.member)) fail("forbidden");
    await ctx.db.patch(ctx.tripId, { membersCanDeletePlaces, updatedAt: Date.now() });
  },
});

export const archive = tripMutation({
  args: {},
  handler: async (ctx) => {
    if (ctx.member.role !== "owner") fail("forbidden");
    await ctx.db.patch(ctx.tripId, { status: "archived", updatedAt: Date.now() });
  },
});

/** Owner deletes the trip permanently (rows and files, in batches). */
export const remove = tripMutation({
  args: {},
  handler: async (ctx) => {
    if (ctx.member.role !== "owner") fail("forbidden");
    await ctx.scheduler.runAfter(0, internal.purge.tripStep, { tripId: ctx.tripId });
    // Hide it right away; the purge finishes in the background
    await ctx.db.patch(ctx.tripId, { status: "archived", updatedAt: Date.now() });
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_trip", (q) => q.eq("tripId", ctx.tripId))
      .collect();
    for (const membership of memberships) await ctx.db.delete(membership._id);
  },
});

/** The trip plus the caller's seat in it. */
export const get = tripQuery({
  args: {},
  handler: async (ctx) => ({
    trip: ctx.trip,
    me: ctx.member,
    avatarUrl: ctx.trip.ai.avatar?.kind === "file" ? await ctx.storage.getUrl(ctx.trip.ai.avatar.storageId) : null,
  }),
});

/**
 * Resolves a trip reference from a URL: a Convex id, or the Firestore id of
 * a migrated trip (old /t/<id> links and push payloads). Null when the
 * caller isn't a member.
 */
export const resolve = query({
  args: { ref: v.string() },
  handler: async (ctx, { ref }) => {
    const user = await getUser(ctx);
    if (!user) return null;
    const normalized = ctx.db.normalizeId("trips", ref);
    const trip = normalized
      ? await ctx.db.get(normalized)
      : await ctx.db
          .query("trips")
          .withIndex("by_firebaseId", (q) => q.eq("firebaseId", ref))
          .unique();
    if (!trip) return null;
    const member = await ctx.db
      .query("memberships")
      .withIndex("by_trip_user", (q) => q.eq("tripId", trip._id).eq("userId", user._id))
      .unique();
    return member ? trip._id : null;
  },
});

/** "My trips": every trip the caller belongs to, with their role. */
export const mine = userQuery({
  args: {},
  handler: async (ctx) => {
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", ctx.user._id))
      .collect();
    const rows = await Promise.all(
      memberships.map(async (membership) => {
        const trip = await ctx.db.get(membership.tripId);
        if (!trip || trip.status === "archived") return null;
        return {
          id: trip._id,
          name: trip.name,
          emoji: trip.emoji,
          destination: trip.destination.label,
          stops: trip.stops.map((stop) => stop.label),
          startDate: trip.startDate,
          endDate: trip.endDate,
          coverImage: trip.coverImage,
          status: trip.status,
          role: membership.role,
          isOwner: trip.ownerId === ctx.user._id,
        };
      })
    );
    return rows.filter((row) => row !== null);
  },
});
