import { v } from "convex/values";
import { components } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import {
  chatRecord,
  documentRecord,
  eventRecord,
  expenseRecord,
  familyRecord,
  inviteRecord,
  membershipRecord,
  placeRecord,
  pollRecord,
  tripRecord,
  usageRecord,
  userRecord,
} from "./lib/migrationRecords";

/**
 * Firestore → Convex load step (run by scripts/migrate with an admin key).
 * Every mutation is an upsert keyed by the Firestore id, so the whole load
 * can be repeated until the verify step is clean. Order: users → trips →
 * families → memberships → places → events/expenses/polls → documents →
 * chats → invites → usage.
 */

class MissingRef extends Error {}

async function tripByFid(ctx: MutationCtx, firebaseId: string): Promise<Id<"trips">> {
  const trip = await ctx.db
    .query("trips")
    .withIndex("by_firebaseId", (q) => q.eq("firebaseId", firebaseId))
    .unique();
  if (!trip) throw new MissingRef(`trip ${firebaseId}`);
  return trip._id;
}

async function userByFid(ctx: MutationCtx, firebaseUid: string): Promise<Id<"users"> | null> {
  const user = await ctx.db
    .query("users")
    .withIndex("by_firebaseUid", (q) => q.eq("firebaseUid", firebaseUid))
    .unique();
  return user?._id ?? null;
}

async function familyByKey(ctx: MutationCtx, tripId: Id<"trips">, key: string): Promise<Id<"families"> | null> {
  const family = await ctx.db
    .query("families")
    .withIndex("by_trip_key", (q) => q.eq("tripId", tripId).eq("key", key))
    .unique();
  return family?._id ?? null;
}

async function placeByFid(ctx: MutationCtx, tripId: Id<"trips">, firebaseId: string): Promise<Id<"places"> | null> {
  const place = await ctx.db
    .query("places")
    .withIndex("by_firebaseId", (q) => q.eq("tripId", tripId).eq("firebaseId", firebaseId))
    .unique();
  return place?._id ?? null;
}

export const upsertUsers = internalMutation({
  args: { records: v.array(userRecord) },
  handler: async (ctx, { records }) => {
    for (const record of records) {
      const authId =
        record.accounts.length && record.email
          ? await ctx.runMutation(components.betterAuth.migration.importUser, {
              email: record.email,
              name: record.name,
              image: record.image ?? null,
              emailVerified: record.emailVerified,
              createdAt: record.createdAt,
              accounts: record.accounts,
            })
          : // Kid / shared-device identities: content keeps its author, nobody can sign in as it
            `legacy:${record.firebaseUid}`;
      const fields = {
        authId,
        name: record.name,
        email: record.email,
        image: record.image,
        guest: record.accounts.length === 0,
        firebaseUid: record.firebaseUid,
        updatedAt: Date.now(),
      };
      const existing = await userByFid(ctx, record.firebaseUid);
      if (existing) await ctx.db.patch(existing, fields);
      else await ctx.db.insert("users", { ...fields, createdAt: record.createdAt });
    }
  },
});

export const upsertTrips = internalMutation({
  args: { records: v.array(tripRecord) },
  handler: async (ctx, { records }) => {
    for (const { ownerFirebaseUid, firebaseId, ...fields } of records) {
      const ownerId = await userByFid(ctx, ownerFirebaseUid);
      if (!ownerId) throw new MissingRef(`owner ${ownerFirebaseUid}`);
      const row = { ...fields, ownerId, plan: "free" as const, firebaseId };
      const existing = await ctx.db
        .query("trips")
        .withIndex("by_firebaseId", (q) => q.eq("firebaseId", firebaseId))
        .unique();
      if (existing) await ctx.db.patch(existing._id, row);
      else await ctx.db.insert("trips", row);
    }
  },
});

export const upsertFamilies = internalMutation({
  args: { records: v.array(familyRecord) },
  handler: async (ctx, { records }) => {
    for (const { tripFid, key, ...fields } of records) {
      const tripId = await tripByFid(ctx, tripFid);
      const existing = await familyByKey(ctx, tripId, key);
      if (existing) await ctx.db.patch(existing, fields);
      else await ctx.db.insert("families", { tripId, key, ...fields });
    }
  },
});

export const upsertMemberships = internalMutation({
  args: { records: v.array(membershipRecord) },
  handler: async (ctx, { records }) => {
    for (const { tripFid, userFid, familyKey, ...fields } of records) {
      const tripId = await tripByFid(ctx, tripFid);
      const userId = await userByFid(ctx, userFid);
      if (!userId) throw new MissingRef(`member ${userFid}`);
      const row = { ...fields, familyId: familyKey ? await familyByKey(ctx, tripId, familyKey) : null };
      const existing = await ctx.db
        .query("memberships")
        .withIndex("by_trip_user", (q) => q.eq("tripId", tripId).eq("userId", userId))
        .unique();
      if (existing) await ctx.db.patch(existing._id, row);
      else await ctx.db.insert("memberships", { tripId, userId, ...row });
    }
  },
});

export const upsertPlaces = internalMutation({
  args: { records: v.array(placeRecord) },
  handler: async (ctx, { records }) => {
    for (const { tripFid, firebaseId, creatorFid, ...fields } of records) {
      const tripId = await tripByFid(ctx, tripFid);
      const createdBy = creatorFid ? ((await userByFid(ctx, creatorFid)) ?? undefined) : undefined;
      const row = { ...fields, createdBy };
      const existing = await ctx.db
        .query("places")
        .withIndex("by_firebaseId", (q) => q.eq("tripId", tripId).eq("firebaseId", firebaseId))
        .unique();
      if (existing) await ctx.db.patch(existing._id, row);
      else await ctx.db.insert("places", { tripId, firebaseId, ...row });
    }
  },
});

export const upsertEvents = internalMutation({
  args: { records: v.array(eventRecord) },
  handler: async (ctx, { records }) => {
    for (const { tripFid, firebaseId, creatorFid, placeFid, participants, ...fields } of records) {
      const tripId = await tripByFid(ctx, tripFid);
      const familyIds =
        participants.type === "families"
          ? (await Promise.all(participants.familyKeys.map((key) => familyByKey(ctx, tripId, key)))).filter(
              (id): id is Id<"families"> => id !== null
            )
          : [];
      const row = {
        ...fields,
        placeId: placeFid ? await placeByFid(ctx, tripId, placeFid) : null,
        participants:
          participants.type === "families"
            ? familyIds.length
              ? { type: "families" as const, familyIds }
              : { type: "all" as const }
            : participants,
        createdBy: creatorFid ? ((await userByFid(ctx, creatorFid)) ?? undefined) : undefined,
      };
      const existing = await ctx.db
        .query("events")
        .withIndex("by_firebaseId", (q) => q.eq("tripId", tripId).eq("firebaseId", firebaseId))
        .unique();
      if (existing) await ctx.db.patch(existing._id, row);
      else await ctx.db.insert("events", { tripId, firebaseId, ...row });
    }
  },
});

export const upsertExpenses = internalMutation({
  args: { records: v.array(expenseRecord) },
  handler: async (ctx, { records }) => {
    for (const { tripFid, firebaseId, payerFamilyKey, participantFamilyKeys, participantCounts, ...fields } of records) {
      const tripId = await tripByFid(ctx, tripFid);
      const payerFamilyId = await familyByKey(ctx, tripId, payerFamilyKey);
      if (!payerFamilyId) throw new MissingRef(`payer family ${payerFamilyKey}`);
      const keys = participantFamilyKeys ?? null;
      const ids = keys ? await Promise.all(keys.map((key) => familyByKey(ctx, tripId, key))) : null;
      const counts = participantCounts
        ? Object.fromEntries(
            (
              await Promise.all(
                Object.entries(participantCounts).map(async ([key, people]) => [await familyByKey(ctx, tripId, key), people] as const)
              )
            ).filter((entry): entry is readonly [Id<"families">, number] => entry[0] !== null)
          )
        : undefined;
      const row = {
        ...fields,
        payerFamilyId,
        participantFamilyIds: ids ? ids.filter((id): id is Id<"families"> => id !== null) : null,
        participantCounts: counts,
      };
      const existing = await ctx.db
        .query("expenses")
        .withIndex("by_firebaseId", (q) => q.eq("tripId", tripId).eq("firebaseId", firebaseId))
        .unique();
      if (existing) await ctx.db.patch(existing._id, row);
      else await ctx.db.insert("expenses", { tripId, firebaseId, ...row });
    }
  },
});

export const upsertPolls = internalMutation({
  args: { records: v.array(pollRecord) },
  handler: async (ctx, { records }) => {
    for (const { tripFid, firebaseId, options, votes, ...fields } of records) {
      const tripId = await tripByFid(ctx, tripFid);
      const row = {
        ...fields,
        options: await Promise.all(
          options.map(async ({ placeFid, ...option }) => ({ ...option, placeId: placeFid ? await placeByFid(ctx, tripId, placeFid) : null }))
        ),
      };
      const existing = await ctx.db
        .query("polls")
        .withIndex("by_firebaseId", (q) => q.eq("tripId", tripId).eq("firebaseId", firebaseId))
        .unique();
      let pollId: Id<"polls">;
      if (existing) {
        pollId = existing._id;
        await ctx.db.patch(pollId, row);
      } else pollId = await ctx.db.insert("polls", { tripId, firebaseId, ...row });
      for (const vote of votes) {
        const userId = await userByFid(ctx, vote.userFid);
        if (!userId) continue;
        const existing = await ctx.db
          .query("pollVotes")
          .withIndex("by_poll_user", (q) => q.eq("pollId", pollId).eq("userId", userId))
          .unique();
        if (existing) await ctx.db.patch(existing._id, { optionId: vote.optionId, name: vote.name });
        else await ctx.db.insert("pollVotes", { pollId, tripId, userId, optionId: vote.optionId, name: vote.name });
      }
    }
  },
});

export const upsertDocuments = internalMutation({
  args: { records: v.array(documentRecord) },
  handler: async (ctx, { records }) => {
    for (const { tripFid, firebaseId, ownerFid, ...fields } of records) {
      const tripId = await tripByFid(ctx, tripFid);
      const ownerId = await userByFid(ctx, ownerFid);
      if (!ownerId) throw new MissingRef(`document owner ${ownerFid}`);
      const existing = (
        await ctx.db
          .query("documents")
          .withIndex("by_trip_owner", (q) => q.eq("tripId", tripId).eq("ownerId", ownerId))
          .collect()
      ).find((doc) => doc.firebaseId === firebaseId);
      if (existing) {
        if (existing.storageId !== fields.storageId) await ctx.storage.delete(existing.storageId);
        await ctx.db.patch(existing._id, fields);
      } else await ctx.db.insert("documents", { tripId, ownerId, firebaseId, ...fields });
    }
  },
});

export const upsertChats = internalMutation({
  args: { records: v.array(chatRecord) },
  handler: async (ctx, { records }) => {
    for (const { tripFid, firebaseId, ownerFid, messages, ...fields } of records) {
      const tripId = await tripByFid(ctx, tripFid);
      const ownerId = await userByFid(ctx, ownerFid);
      if (!ownerId) throw new MissingRef(`chat owner ${ownerFid}`);
      const existing = (
        await ctx.db
          .query("chatSessions")
          .withIndex("by_trip_owner", (q) => q.eq("tripId", tripId).eq("ownerId", ownerId))
          .collect()
      ).find((session) => session.firebaseId === firebaseId);
      let sessionId: Id<"chatSessions">;
      if (existing) {
        sessionId = existing._id;
        await ctx.db.patch(sessionId, fields);
        // Messages are replaced wholesale on re-run
        const old = await ctx.db
          .query("chatMessages")
          .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
          .collect();
        for (const message of old) await ctx.db.delete(message._id);
      } else {
        sessionId = await ctx.db.insert("chatSessions", { tripId, ownerId, firebaseId, ...fields });
      }
      for (const [index, { candidates, ...message }] of messages.entries()) {
        await ctx.db.insert("chatMessages", {
          sessionId,
          ...message,
          status: "done",
          // Keep the original order inside the session
          createdAt: fields.createdAt + index,
          candidates: candidates
            ? await Promise.all(
                candidates.map(async ({ savedPlaceFid, ...candidate }) => ({
                  ...candidate,
                  savedPlaceId: savedPlaceFid ? ((await placeByFid(ctx, tripId, savedPlaceFid)) ?? undefined) : undefined,
                }))
              )
            : undefined,
        });
      }
    }
  },
});

export const upsertInvites = internalMutation({
  args: { records: v.array(inviteRecord) },
  handler: async (ctx, { records }) => {
    for (const { tripFid, familyKey, creatorFid, ...fields } of records) {
      const tripId = await tripByFid(ctx, tripFid);
      const createdBy = await userByFid(ctx, creatorFid);
      if (!createdBy) continue;
      const row = { ...fields, tripId, createdBy, familyId: familyKey ? await familyByKey(ctx, tripId, familyKey) : null };
      const existing = await ctx.db
        .query("invites")
        .withIndex("by_code", (q) => q.eq("code", fields.code))
        .unique();
      if (existing) await ctx.db.patch(existing._id, row);
      else await ctx.db.insert("invites", row);
    }
  },
});

export const upsertUsage = internalMutation({
  args: { records: v.array(usageRecord) },
  handler: async (ctx, { records }) => {
    for (const { tripFid, month, ...fields } of records) {
      const tripId = await tripByFid(ctx, tripFid);
      const existing = await ctx.db
        .query("usage")
        .withIndex("by_trip_month", (q) => q.eq("tripId", tripId).eq("month", month))
        .unique();
      if (existing) await ctx.db.patch(existing._id, fields);
      else await ctx.db.insert("usage", { tripId, month, ...fields });
    }
  },
});

/** Upload target for copied Firebase Storage objects. */
export const uploadUrl = internalMutation({
  args: {},
  handler: async (ctx) => ctx.storage.generateUploadUrl(),
});

/** Row counts per migrated trip, for the verify step (no personal data). */
export const counts = internalQuery({
  args: {},
  handler: async (ctx) => {
    const trips = await ctx.db.query("trips").collect();
    const users = await ctx.db.query("users").collect();
    const perTrip = await Promise.all(
      trips.map(async (trip) => {
        const count = async (table: "memberships" | "families" | "places" | "expenses" | "polls" | "invites") =>
          (await ctx.db.query(table).withIndex("by_trip", (q) => q.eq("tripId", trip._id)).collect()).length;
        return {
          firebaseId: trip.firebaseId ?? null,
          memberships: await count("memberships"),
          families: await count("families"),
          places: await count("places"),
          expenses: await count("expenses"),
          polls: await count("polls"),
          invites: await count("invites"),
          events: (await ctx.db.query("events").withIndex("by_trip_day", (q) => q.eq("tripId", trip._id)).collect()).length,
          documents: (await ctx.db.query("documents").withIndex("by_trip_visibility", (q) => q.eq("tripId", trip._id)).collect()).length,
          chats: (await ctx.db.query("chatSessions").withIndex("by_trip", (q) => q.eq("tripId", trip._id)).collect()).length,
        };
      })
    );
    return {
      users: users.length,
      accounts: users.filter((user) => !user.authId.startsWith("legacy:")).length,
      trips: perTrip,
    };
  },
});
