import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";

/**
 * Permanent deletion behind "delete trip", "leave / remove member" and
 * "delete my account". Runs in small scheduled batches so a big trip never
 * hits per-mutation limits. Nothing here is soft: rows and files go.
 */
const BATCH = 200;

async function deleteChatSessions(ctx: MutationCtx, sessionIds: Id<"chatSessions">[]) {
  let count = 0;
  for (const sessionId of sessionIds) {
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .take(BATCH);
    for (const message of messages) {
      if (message.imageStorageId) await ctx.storage.delete(message.imageStorageId);
      await ctx.db.delete(message._id);
      count++;
    }
    if (messages.length < BATCH) {
      await ctx.db.delete(sessionId);
      count++;
    }
  }
  return count;
}

/** One batch of a whole-trip purge; reschedules itself until nothing is left. */
export const tripStep = internalMutation({
  args: { tripId: v.id("trips") },
  handler: async (ctx, { tripId }) => {
    let deleted = 0;
    const drop = async (rows: { _id: Id<any> }[]) => {
      for (const row of rows) await ctx.db.delete(row._id);
      deleted += rows.length;
    };

    const sessions = await ctx.db.query("chatSessions").withIndex("by_trip", (q) => q.eq("tripId", tripId)).take(10);
    deleted += await deleteChatSessions(ctx, sessions.map((s) => s._id));

    const documents = await ctx.db
      .query("documents")
      .withIndex("by_trip_visibility", (q) => q.eq("tripId", tripId))
      .take(BATCH);
    for (const doc of documents) await ctx.storage.delete(doc.storageId);
    await drop(documents);

    const imports = await ctx.db.query("imports").withIndex("by_trip", (q) => q.eq("tripId", tripId)).take(BATCH);
    for (const row of imports) if (row.storageId) await ctx.storage.delete(row.storageId);
    await drop(imports);

    const events = await ctx.db.query("events").withIndex("by_trip_day", (q) => q.eq("tripId", tripId)).take(BATCH);
    for (const event of events) if (event.reminderJobId) await ctx.scheduler.cancel(event.reminderJobId);
    await drop(events);

    await drop(await ctx.db.query("places").withIndex("by_trip", (q) => q.eq("tripId", tripId)).take(BATCH));
    await drop(await ctx.db.query("expenses").withIndex("by_trip", (q) => q.eq("tripId", tripId)).take(BATCH));
    await drop(await ctx.db.query("pollVotes").withIndex("by_trip_user", (q) => q.eq("tripId", tripId)).take(BATCH));
    await drop(await ctx.db.query("polls").withIndex("by_trip", (q) => q.eq("tripId", tripId)).take(BATCH));
    await drop(await ctx.db.query("families").withIndex("by_trip", (q) => q.eq("tripId", tripId)).take(BATCH));
    await drop(await ctx.db.query("invites").withIndex("by_trip", (q) => q.eq("tripId", tripId)).take(BATCH));
    await drop(await ctx.db.query("locations").withIndex("by_trip_user", (q) => q.eq("tripId", tripId)).take(BATCH));
    await drop(await ctx.db.query("usage").withIndex("by_trip_month", (q) => q.eq("tripId", tripId)).take(BATCH));
    await drop(
      await ctx.db.query("webPushSubscriptions").withIndex("by_trip", (q) => q.eq("tripId", tripId)).take(BATCH)
    );
    await drop(await ctx.db.query("memberships").withIndex("by_trip", (q) => q.eq("tripId", tripId)).take(BATCH));

    if (deleted > 0) {
      await ctx.scheduler.runAfter(0, internal.purge.tripStep, { tripId });
      return;
    }
    const trip = await ctx.db.get(tripId);
    if (trip?.ai.avatar?.kind === "file") await ctx.storage.delete(trip.ai.avatar.storageId);
    if (trip) await ctx.db.delete(tripId);
  },
});

/**
 * Everything one person has in one trip: chats, documents (files too),
 * imports, votes, location, push devices. Shared places/events they created
 * stay for the group, without their name on them. The membership row is
 * removed by the caller.
 */
export const userFromTrip = internalMutation({
  args: { tripId: v.id("trips"), userId: v.id("users") },
  handler: async (ctx, { tripId, userId }) => {
    const sessions = await ctx.db
      .query("chatSessions")
      .withIndex("by_trip_owner", (q) => q.eq("tripId", tripId).eq("ownerId", userId))
      .collect();
    await deleteChatSessions(ctx, sessions.map((s) => s._id));

    const documents = await ctx.db
      .query("documents")
      .withIndex("by_trip_owner", (q) => q.eq("tripId", tripId).eq("ownerId", userId))
      .collect();
    for (const doc of documents) {
      await ctx.storage.delete(doc.storageId);
      await ctx.db.delete(doc._id);
    }
    const imports = await ctx.db
      .query("imports")
      .withIndex("by_trip_creator", (q) => q.eq("tripId", tripId).eq("createdBy", userId))
      .collect();
    for (const row of imports) {
      if (row.storageId) await ctx.storage.delete(row.storageId);
      await ctx.db.delete(row._id);
    }
    const votes = await ctx.db
      .query("pollVotes")
      .withIndex("by_trip_user", (q) => q.eq("tripId", tripId).eq("userId", userId))
      .collect();
    for (const vote of votes) await ctx.db.delete(vote._id);
    const locations = await ctx.db
      .query("locations")
      .withIndex("by_trip_user", (q) => q.eq("tripId", tripId).eq("userId", userId))
      .collect();
    for (const row of locations) await ctx.db.delete(row._id);
    const subscriptions = await ctx.db
      .query("webPushSubscriptions")
      .withIndex("by_trip_user", (q) => q.eq("tripId", tripId).eq("userId", userId))
      .collect();
    for (const row of subscriptions) await ctx.db.delete(row._id);

    for (const table of ["places", "events"] as const) {
      const rows = await ctx.db
        .query(table)
        .withIndex("by_creator", (q) => q.eq("createdBy", userId))
        .collect();
      for (const row of rows) {
        if (row.tripId === tripId) await ctx.db.patch(row._id, { createdBy: undefined, createdByName: undefined });
      }
    }
  },
});
