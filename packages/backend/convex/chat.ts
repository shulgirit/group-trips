import { isLocale, type Locale } from "@together/i18n/config";
import { translate } from "@together/i18n/translate";
import { GROUP_KINDS } from "@together/shared/trip-doc";
import { PLACE_CATEGORIES, type PlaceCategory } from "@together/shared/types";
import { type Infer, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import { insertEvent } from "./events";
import { fail } from "./lib/authz";
import { tripMutation, tripQuery } from "./lib/functions";
import { quotaLeft, recordUsage } from "./lib/limits";
import { chatCandidate, participants } from "./lib/validators";
import { insertPlace, placeInput } from "./places";
import { addToIdeasPoll, insertPoll } from "./polls";
import { notifyGroup } from "./push";

/**
 * The trip guide chat. Sending stores the user's message plus a `pending`
 * assistant message and schedules chatRun.run (the OpenAI tool loop); the
 * client just subscribes to the messages — no long HTTP request, works
 * the same on web and mobile. Chats are private to their owner.
 */

const MAX_TEXT = 4000;
const HISTORY = 30;

async function ownSession(ctx: { db: MutationCtx["db"] }, sessionId: Id<"chatSessions">, tripId: Id<"trips">, userId: Id<"users">) {
  const session = await ctx.db.get(sessionId);
  if (!session || session.tripId !== tripId || session.ownerId !== userId) fail("not_found");
  return session;
}

export const sessions = tripQuery({
  args: {},
  handler: async (ctx) =>
    ctx.db
      .query("chatSessions")
      .withIndex("by_trip_owner", (q) => q.eq("tripId", ctx.tripId).eq("ownerId", ctx.user._id))
      .order("desc")
      .collect(),
});

export const messages = tripQuery({
  args: { sessionId: v.id("chatSessions") },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db.get(sessionId);
    if (!session || session.tripId !== ctx.tripId || session.ownerId !== ctx.user._id) return [];
    const rows = await ctx.db
      .query("chatMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect();
    return Promise.all(
      rows.map(async (row) => ({
        ...row,
        imageUrl: row.imageStorageId ? await ctx.storage.getUrl(row.imageStorageId) : null,
      }))
    );
  },
});

export const renameSession = tripMutation({
  args: { sessionId: v.id("chatSessions"), title: v.string() },
  handler: async (ctx, { sessionId, title }) => {
    await ownSession(ctx, sessionId, ctx.tripId, ctx.user._id);
    await ctx.db.patch(sessionId, { title: title.trim().slice(0, 80) });
  },
});

export const deleteSession = tripMutation({
  args: { sessionId: v.id("chatSessions") },
  handler: async (ctx, { sessionId }) => {
    await ownSession(ctx, sessionId, ctx.tripId, ctx.user._id);
    const rows = await ctx.db
      .query("chatMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect();
    for (const row of rows) {
      if (row.imageStorageId) await ctx.storage.delete(row.imageStorageId);
      await ctx.db.delete(row._id);
    }
    await ctx.db.delete(sessionId);
  },
});

/** Sends a message (new chat when sessionId is omitted); the reply streams into the pending message. */
export const send = tripMutation({
  args: {
    sessionId: v.optional(v.id("chatSessions")),
    text: v.string(),
    imageStorageId: v.optional(v.id("_storage")),
    locale: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const text = args.text.trim();
    if ((!text && !args.imageStorageId) || text.length > MAX_TEXT) fail("invalid", "message");
    if (!(await quotaLeft(ctx, ctx.tripId, "aiCalls"))) fail("limit", "quota_exceeded");
    const now = Date.now();
    const sessionId =
      args.sessionId ??
      (await ctx.db.insert("chatSessions", {
        tripId: ctx.tripId,
        ownerId: ctx.user._id,
        title: text.slice(0, 60),
        createdAt: now,
        updatedAt: now,
      }));
    if (args.sessionId) {
      await ownSession(ctx, sessionId, ctx.tripId, ctx.user._id);
      await ctx.db.patch(sessionId, { updatedAt: now });
    }
    // Strictly after the session's last message, even within one millisecond
    const last = await ctx.db
      .query("chatMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .order("desc")
      .first();
    const at = Math.max(now, (last?.createdAt ?? 0) + 1);
    await ctx.db.insert("chatMessages", {
      sessionId,
      role: "user",
      content: text,
      status: "done",
      imageStorageId: args.imageStorageId,
      createdAt: at,
    });
    const replyId = await ctx.db.insert("chatMessages", {
      sessionId,
      role: "assistant",
      content: "",
      status: "pending",
      createdAt: at + 1,
    });
    await recordUsage(ctx, ctx.tripId, "aiCalls");
    const locale = isLocale(args.locale) ? args.locale : isLocale(ctx.user.locale) ? ctx.user.locale : "he";
    await ctx.scheduler.runAfter(0, internal.chatRun.run, { replyId, locale });
    return { sessionId, replyId };
  },
});

/** Re-runs a failed reply in place (the question is not sent twice). */
export const retry = tripMutation({
  args: { replyId: v.id("chatMessages"), locale: v.optional(v.string()) },
  handler: async (ctx, { replyId, locale }) => {
    const reply = await ctx.db.get(replyId);
    if (!reply || reply.role !== "assistant" || reply.status !== "error") fail("not_found");
    await ownSession(ctx, reply.sessionId, ctx.tripId, ctx.user._id);
    if (!(await quotaLeft(ctx, ctx.tripId, "aiCalls"))) fail("limit", "quota_exceeded");
    await ctx.db.patch(replyId, { status: "pending", content: "" });
    await recordUsage(ctx, ctx.tripId, "aiCalls");
    const lang = isLocale(locale) ? locale : isLocale(ctx.user.locale) ? ctx.user.locale : "he";
    await ctx.scheduler.runAfter(0, internal.chatRun.run, { replyId, locale: lang });
  },
});

// ── candidate cards ───────────────────────────────────────────────────

async function ownCandidate(ctx: MutationCtx, messageId: Id<"chatMessages">, index: number, tripId: Id<"trips">, userId: Id<"users">) {
  const message = await ctx.db.get(messageId);
  if (!message) fail("not_found");
  await ownSession(ctx, message.sessionId, tripId, userId);
  const candidate = message.candidates?.[index];
  if (!candidate) fail("not_found");
  return { message, candidate };
}

async function patchCandidate(
  ctx: MutationCtx,
  message: Doc<"chatMessages">,
  index: number,
  patch: Partial<Infer<typeof chatCandidate>>
) {
  const candidates = [...(message.candidates ?? [])];
  candidates[index] = { ...candidates[index], ...patch };
  await ctx.db.patch(message._id, { candidates });
}

/** Saves a recommended place to the trip (deduped) and links it to the card. */
export const saveCandidate = tripMutation({
  args: { messageId: v.id("chatMessages"), index: v.number() },
  handler: async (ctx, { messageId, index }) => {
    const { message, candidate } = await ownCandidate(ctx, messageId, index, ctx.tripId, ctx.user._id);
    if (candidate.savedPlaceId) return candidate.savedPlaceId;
    const category = (candidate.category in PLACE_CATEGORIES ? candidate.category : "other") as PlaceCategory;
    const { id } = await insertPlace(
      ctx,
      ctx.tripId,
      {
        name: candidate.name,
        category,
        area: candidate.area,
        address: candidate.address,
        lat: candidate.lat ?? null,
        lng: candidate.lng ?? null,
        website: candidate.website,
        imageUrl: candidate.imageUrl,
        summary: `${candidate.description}\n\n${candidate.why}`,
        priceNotes: candidate.priceNotes,
      },
      { userId: ctx.user._id, name: ctx.member.displayName }
    );
    await patchCandidate(ctx, message, index, { savedPlaceId: id });
    return id;
  },
});

export const markCandidate = tripMutation({
  args: { messageId: v.id("chatMessages"), index: v.number(), dismissed: v.optional(v.boolean()), polled: v.optional(v.boolean()) },
  handler: async (ctx, { messageId, index, dismissed, polled }) => {
    const { message } = await ownCandidate(ctx, messageId, index, ctx.tripId, ctx.user._id);
    await patchCandidate(ctx, message, index, {
      ...(dismissed !== undefined ? { dismissed } : {}),
      ...(polled !== undefined ? { polled } : {}),
    });
  },
});

// ── internal: context for the AI run ──────────────────────────────────

/** Everything the guide needs for one reply (the run action has no db). */
export const runContext = internalQuery({
  args: { replyId: v.id("chatMessages") },
  handler: async (ctx, { replyId }) => {
    const reply = await ctx.db.get(replyId);
    if (!reply || reply.status !== "pending") return null;
    const session = await ctx.db.get(reply.sessionId);
    const trip = session ? await ctx.db.get(session.tripId) : null;
    const user = session ? await ctx.db.get(session.ownerId) : null;
    if (!session || !trip || !user) return null;

    const [families, places, events, polls, member, history] = await Promise.all([
      ctx.db.query("families").withIndex("by_trip", (q) => q.eq("tripId", trip._id)).collect(),
      ctx.db.query("places").withIndex("by_trip", (q) => q.eq("tripId", trip._id)).collect(),
      ctx.db.query("events").withIndex("by_trip_day", (q) => q.eq("tripId", trip._id)).collect(),
      ctx.db.query("polls").withIndex("by_trip", (q) => q.eq("tripId", trip._id)).collect(),
      ctx.db.query("memberships").withIndex("by_trip_user", (q) => q.eq("tripId", trip._id).eq("userId", user._id)).unique(),
      ctx.db.query("chatMessages").withIndex("by_session", (q) => q.eq("sessionId", session._id)).order("desc").take(HISTORY + 1),
    ]);
    const pollsWithVotes = await Promise.all(
      polls.map(async (poll) => {
        const votes = await ctx.db.query("pollVotes").withIndex("by_poll", (q) => q.eq("pollId", poll._id)).collect();
        return {
          question: poll.question,
          closed: poll.closed,
          options: poll.options.map((option) => ({ label: option.label, votes: votes.filter((vote) => vote.optionId === option.id).length })),
        };
      })
    );
    const turns = await Promise.all(
      history
        .filter((row) => row._id !== replyId && row.status === "done")
        .reverse()
        .map(async (row) => ({
          role: row.role,
          content: row.content,
          imageUrl: row.imageStorageId ? ((await ctx.storage.getUrl(row.imageStorageId)) ?? undefined) : undefined,
        }))
    );
    const family = families.find((f) => f._id === member?.familyId);
    const memberName = family?.members.find((m) => m.key === member?.memberKey)?.name;
    return {
      trip,
      ownerId: user._id,
      // "Mika from the Tal family" — only for real accounts, as on the web
      speakerName: user.guest ? undefined : (memberName ?? member?.displayName ?? user.name),
      speakerFamily: user.guest ? undefined : family?.name,
      families: families.map((f) => ({ id: f._id as string, name: f.name, members: f.members.map((m) => ({ key: m.key, name: m.name })) })),
      places: places.map((p) => ({ id: p._id as string, name: p.name, category: p.category, ...(p.area ? { area: p.area } : {}) })),
      events: events.map((e) => ({ day: e.day, startTime: e.startTime, title: e.title })),
      polls: pollsWithVotes,
      turns,
    };
  },
});

export function rosterLabel(trip: Doc<"trips">): string {
  if (trip.legacyKey === "sicily") return "המשפחות:";
  if (trip.legacyKey === "sardinia") return "החברים:";
  return `${GROUP_KINDS[trip.groupKind].unitLabel}:`;
}

export function speakerLine(locale: Locale, name: string | undefined, family: string | undefined): string | undefined {
  if (!name) return undefined;
  return family ? translate(locale, "ai.speaker", { name, family }) : name;
}

// ── internal: results and tool side effects ───────────────────────────

export const finish = internalMutation({
  args: { replyId: v.id("chatMessages"), content: v.string(), candidates: v.array(chatCandidate) },
  handler: async (ctx, { replyId, content, candidates }) => {
    const reply = await ctx.db.get(replyId);
    if (!reply) return;
    await ctx.db.patch(replyId, { content, candidates, status: "done" });
    await ctx.db.patch(reply.sessionId, { updatedAt: Date.now() });
  },
});

export const logRun = internalMutation({
  args: {
    tripId: v.id("trips"),
    ok: v.boolean(),
    totalMs: v.number(),
    llmMs: v.number(),
    toolMs: v.number(),
    decorateMs: v.number(),
    rounds: v.number(),
    firstEffort: v.string(),
    tools: v.array(v.string()),
    promptTokens: v.number(),
    completionTokens: v.number(),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("aiRuns", { ...args, createdAt: Date.now() });
  },
});

/** The reply text so far, while the model is still writing. Only touches a reply that is still pending. */
export const streamReply = internalMutation({
  args: { replyId: v.id("chatMessages"), content: v.string() },
  handler: async (ctx, { replyId, content }) => {
    const reply = await ctx.db.get(replyId);
    if (reply && reply.status === "pending" && content.length > reply.content.length) await ctx.db.patch(replyId, { content });
  },
});

export const failReply = internalMutation({
  args: { replyId: v.id("chatMessages"), content: v.string() },
  handler: async (ctx, { replyId, content }) => {
    if (await ctx.db.get(replyId)) await ctx.db.patch(replyId, { content, status: "error" });
  },
});

export const toolAddPlace = internalMutation({
  args: { tripId: v.id("trips"), input: placeInput, createdByName: v.string() },
  handler: async (ctx, { tripId, input, createdByName }) => insertPlace(ctx, tripId, input, { name: createdByName }),
});

export const toolCreateEvent = internalMutation({
  args: {
    tripId: v.id("trips"),
    title: v.string(),
    emoji: v.optional(v.string()),
    day: v.string(),
    startTime: v.string(),
    durationMin: v.optional(v.number()),
    placeId: v.union(v.id("places"), v.null()),
    participants,
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { tripId, ...input }) => {
    const trip = await ctx.db.get(tripId);
    if (!trip) fail("not_found");
    return insertEvent(ctx, trip, input, { name: trip.ai.name, aiName: trip.ai.name });
  },
});

export const toolCreatePoll = internalMutation({
  args: {
    tripId: v.id("trips"),
    question: v.string(),
    options: v.array(v.object({ label: v.string(), placeId: v.union(v.id("places"), v.null()) })),
  },
  handler: async (ctx, { tripId, question, options }) => insertPoll(ctx, tripId, question, options, {}),
});

export const toolAddIdea = internalMutation({
  args: { tripId: v.id("trips"), label: v.string(), placeId: v.union(v.id("places"), v.null()), locale: v.string() },
  handler: async (ctx, { tripId, label, placeId, locale }) =>
    // One combined "ideas updated" push is sent when the reply finishes
    addToIdeasPoll(ctx, tripId, label, placeId, { locale }, { notify: false }),
});

export const notifyIdeas = internalMutation({
  args: { tripId: v.id("trips"), labels: v.array(v.string()), excludeUserId: v.id("users") },
  handler: async (ctx, { tripId, labels, excludeUserId }) => {
    if (labels.length) await notifyGroup(ctx, tripId, { type: "ideas_updated", labels }, { excludeUserId });
  },
});

export const placeForEnrich = internalQuery({
  args: { placeId: v.id("places") },
  handler: async (ctx, { placeId }) => ctx.db.get(placeId),
});
