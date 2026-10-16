import { translate } from "@together/i18n/translate";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { fail } from "./lib/authz";
import { tripMutation, tripQuery } from "./lib/functions";
import { localeOf } from "./lib/notices";
import { notifyGroup } from "./push";

const optionId = () => `opt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

async function loadPoll(ctx: MutationCtx, tripId: Id<"trips">, pollId: Id<"polls">) {
  const poll = await ctx.db.get(pollId);
  if (!poll || poll.tripId !== tripId) fail("not_found");
  return poll;
}

const hasOption = (poll: Doc<"polls">, label: string, placeId?: Id<"places"> | null) =>
  poll.options.some((option) => option.label === label || (placeId && option.placeId === placeId));

/** Polls with their votes (pinned group poll first, newest after). */
export const list = tripQuery({
  args: {},
  handler: async (ctx) => {
    const polls = await ctx.db
      .query("polls")
      .withIndex("by_trip", (q) => q.eq("tripId", ctx.tripId))
      .collect();
    const withVotes = await Promise.all(
      polls.map(async (poll) => {
        const votes = await ctx.db
          .query("pollVotes")
          .withIndex("by_poll", (q) => q.eq("pollId", poll._id))
          .collect();
        return {
          ...poll,
          votes: votes.map((vote) => ({ userId: vote.userId, optionId: vote.optionId, name: vote.name })),
          myVote: votes.find((vote) => vote.userId === ctx.user._id)?.optionId ?? null,
        };
      })
    );
    return withVotes.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt - a.createdAt);
  },
});

export async function insertPoll(
  ctx: MutationCtx,
  tripId: Id<"trips">,
  question: string,
  options: { label: string; placeId?: Id<"places"> | null }[],
  author: { userId?: Id<"users"> }
) {
  const trimmed = question.trim();
  if (!trimmed || !options.length) fail("invalid", "poll");
  const pollId = await ctx.db.insert("polls", {
    tripId,
    question: trimmed,
    options: options.map((option) => ({ id: optionId(), label: option.label.trim(), placeId: option.placeId ?? null })),
    closed: false,
    pinned: false,
    createdBy: author.userId,
    createdAt: Date.now(),
  });
  await notifyGroup(ctx, tripId, { type: "poll", title: trimmed }, { excludeUserId: author.userId });
  return pollId;
}

export const create = tripMutation({
  args: {
    question: v.string(),
    options: v.array(v.object({ label: v.string(), placeId: v.optional(v.union(v.id("places"), v.null())) })),
  },
  handler: async (ctx, { question, options }) => {
    if (options.length < 1 || options.some((option) => !option.label.trim())) fail("invalid", "options");
    return insertPoll(ctx, ctx.tripId, question, options, { userId: ctx.user._id });
  },
});

export const addOption = tripMutation({
  args: { pollId: v.id("polls"), label: v.string(), placeId: v.optional(v.union(v.id("places"), v.null())) },
  handler: async (ctx, { pollId, label, placeId }) => {
    const poll = await loadPoll(ctx, ctx.tripId, pollId);
    if (hasOption(poll, label, placeId)) return "exists" as const;
    await ctx.db.patch(pollId, { options: [...poll.options, { id: optionId(), label: label.trim(), placeId: placeId ?? null }] });
    return "added" as const;
  },
});

/**
 * Adds an option to the always-open group ideas poll (created on first use,
 * titled in the adder's language).
 */
export async function addToIdeasPoll(
  ctx: MutationCtx,
  tripId: Id<"trips">,
  label: string,
  placeId: Id<"places"> | null,
  author: { userId?: Id<"users">; locale?: string },
  options: { notify?: boolean } = {}
): Promise<"added" | "exists"> {
  const polls = await ctx.db
    .query("polls")
    .withIndex("by_trip", (q) => q.eq("tripId", tripId))
    .collect();
  const pinned = polls.find((poll) => poll.pinned);
  const option = { id: optionId(), label: label.trim(), placeId };
  if (pinned) {
    if (hasOption(pinned, label, placeId)) return "exists";
    await ctx.db.patch(pinned._id, { options: [...pinned.options, option] });
  } else {
    await ctx.db.insert("polls", {
      tripId,
      question: translate(localeOf(author.locale), "config.ideasPoll"),
      options: [option],
      closed: false,
      pinned: true,
      createdBy: author.userId,
      createdAt: Date.now(),
    });
  }
  if (options.notify !== false) {
    await notifyGroup(ctx, tripId, { type: "poll_option", title: label }, { excludeUserId: author.userId });
  }
  return "added";
}

export const addToIdeas = tripMutation({
  args: { label: v.string(), placeId: v.optional(v.union(v.id("places"), v.null())) },
  handler: async (ctx, { label, placeId }) =>
    addToIdeasPoll(ctx, ctx.tripId, label, placeId ?? null, { userId: ctx.user._id, locale: ctx.user.locale }),
});

export const removeOption = tripMutation({
  args: { pollId: v.id("polls"), optionId: v.string() },
  handler: async (ctx, { pollId, optionId: removed }) => {
    const poll = await loadPoll(ctx, ctx.tripId, pollId);
    await ctx.db.patch(pollId, { options: poll.options.filter((option) => option.id !== removed) });
    const votes = await ctx.db
      .query("pollVotes")
      .withIndex("by_poll", (q) => q.eq("pollId", pollId))
      .collect();
    for (const vote of votes) if (vote.optionId === removed) await ctx.db.delete(vote._id);
  },
});

export const vote = tripMutation({
  args: { pollId: v.id("polls"), optionId: v.string() },
  handler: async (ctx, { pollId, optionId: chosen }) => {
    const poll = await loadPoll(ctx, ctx.tripId, pollId);
    if (poll.closed) fail("invalid", "closed");
    if (!poll.options.some((option) => option.id === chosen)) fail("invalid", "option");
    const existing = await ctx.db
      .query("pollVotes")
      .withIndex("by_poll_user", (q) => q.eq("pollId", pollId).eq("userId", ctx.user._id))
      .unique();
    if (existing) await ctx.db.patch(existing._id, { optionId: chosen, name: ctx.member.displayName });
    else
      await ctx.db.insert("pollVotes", {
        pollId,
        tripId: ctx.tripId,
        userId: ctx.user._id,
        optionId: chosen,
        name: ctx.member.displayName,
      });
  },
});

export const setClosed = tripMutation({
  args: { pollId: v.id("polls"), closed: v.boolean() },
  handler: async (ctx, { pollId, closed }) => {
    await loadPoll(ctx, ctx.tripId, pollId);
    await ctx.db.patch(pollId, { closed });
  },
});

export const remove = tripMutation({
  args: { pollId: v.id("polls") },
  handler: async (ctx, { pollId }) => {
    await loadPoll(ctx, ctx.tripId, pollId);
    const votes = await ctx.db
      .query("pollVotes")
      .withIndex("by_poll", (q) => q.eq("pollId", pollId))
      .collect();
    for (const row of votes) await ctx.db.delete(row._id);
    await ctx.db.delete(pollId);
  },
});
