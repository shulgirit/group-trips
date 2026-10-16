import { v } from "convex/values";
import { fail } from "./lib/authz";
import { tripMutation, tripQuery } from "./lib/functions";

/** Server-enforced (Storage rules only had it in the client). */
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

/** Short-lived upload URL for any trip upload (documents, chat photos, imports, avatars). */
export const generateUploadUrl = tripMutation({
  args: {},
  handler: async (ctx) => ctx.storage.generateUploadUrl(),
});

/** Shared documents of the trip plus my private ones, with download URLs. */
export const list = tripQuery({
  args: {},
  handler: async (ctx) => {
    const [shared, mine] = await Promise.all([
      ctx.db
        .query("documents")
        .withIndex("by_trip_visibility", (q) => q.eq("tripId", ctx.tripId).eq("visibility", "shared"))
        .collect(),
      ctx.db
        .query("documents")
        .withIndex("by_trip_owner", (q) => q.eq("tripId", ctx.tripId).eq("ownerId", ctx.user._id))
        .collect(),
    ]);
    const rows = [...shared, ...mine.filter((doc) => doc.visibility === "private")];
    return Promise.all(
      rows
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(async (doc) => ({ ...doc, url: await ctx.storage.getUrl(doc.storageId), mine: doc.ownerId === ctx.user._id }))
    );
  },
});

export const create = tripMutation({
  args: {
    storageId: v.id("_storage"),
    name: v.string(),
    visibility: v.union(v.literal("shared"), v.literal("private")),
  },
  handler: async (ctx, { storageId, name, visibility }) => {
    const meta = await ctx.db.system.get(storageId);
    if (!meta) fail("invalid", "file");
    if (meta.size > MAX_DOCUMENT_BYTES) {
      await ctx.storage.delete(storageId);
      fail("limit", "too_large");
    }
    // Private files belong to real accounts, not shared guest devices
    if (visibility === "private" && ctx.user.guest) fail("sign_in_required");
    return ctx.db.insert("documents", {
      tripId: ctx.tripId,
      ownerId: ctx.user._id,
      ownerName: ctx.member.displayName || ctx.user.name,
      visibility,
      name: name.slice(0, 200),
      storageId,
      contentType: meta.contentType ?? "application/octet-stream",
      size: meta.size,
      createdAt: Date.now(),
    });
  },
});

export const remove = tripMutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, { documentId }) => {
    const doc = await ctx.db.get(documentId);
    if (!doc || doc.tripId !== ctx.tripId) fail("not_found");
    if (doc.ownerId !== ctx.user._id) fail("forbidden");
    await ctx.storage.delete(doc.storageId);
    await ctx.db.delete(documentId);
  },
});
