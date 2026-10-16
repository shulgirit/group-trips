import { previewGuide, suggestTripNames, summarizeTrip } from "@together/integrations/assist";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { aiPreset, groupKind } from "./lib/validators";

/** AI helpers for the trip creator: name ideas, a preview of the guide, the trip summary. */

const draft = v.object({
  destination: v.string(),
  startDate: v.string(),
  endDate: v.string(),
  groupKind,
  groupName: v.string(),
  aboutUs: v.optional(v.string()),
});

function configured() {
  if (!process.env.OPENAI_API_KEY) throw new ConvexError({ code: "invalid", detail: "not_configured" });
}

export const names = action({
  args: { draft, locale: v.optional(v.string()) },
  handler: async (ctx, { draft: input, locale }): Promise<{ name: string; emoji: string }[]> => {
    await ctx.runQuery(internal.access.account, {});
    configured();
    return suggestTripNames({ ...input, destination: input.destination.slice(0, 80) }, locale !== "he");
  },
});

export const preview = action({
  args: {
    draft,
    ai: v.object({ name: v.string(), preset: aiPreset, rules: v.array(v.string()), customRules: v.string() }),
    question: v.string(),
    locale: v.optional(v.string()),
  },
  handler: async (ctx, { draft: input, ai, question, locale }): Promise<string> => {
    await ctx.runQuery(internal.access.account, {});
    configured();
    const text = question.trim();
    if (!text || text.length > 300) throw new ConvexError({ code: "invalid", detail: "question" });
    return previewGuide(input, ai, text, locale !== "he");
  },
});

export const summaryInput = internalQuery({
  args: { tripId: v.id("trips") },
  handler: async (ctx, { tripId }) => {
    const [events, families] = await Promise.all([
      ctx.db.query("events").withIndex("by_trip_day", (q) => q.eq("tripId", tripId)).collect(),
      ctx.db.query("families").withIndex("by_trip", (q) => q.eq("tripId", tripId)).collect(),
    ]);
    return {
      schedule: events.map((e) => `${e.day} ${e.startTime} ${e.title}`),
      roster: families.map((f) => `${f.name}: ${f.members.map((m) => m.name).join(", ")}`).join("\n"),
    };
  },
});

export const saveSummary = internalMutation({
  args: { tripId: v.id("trips"), summary: v.string() },
  handler: async (ctx, { tripId, summary }) => {
    if (await ctx.db.get(tripId)) await ctx.db.patch(tripId, { summary });
  },
});

/** The trip at a glance in the guide's voice, saved on the trip (organizers). */
export const summary = action({
  args: { tripId: v.id("trips"), locale: v.optional(v.string()) },
  handler: async (ctx, { tripId, locale }): Promise<string> => {
    const { trip } = await ctx.runQuery(internal.access.member, { tripId, admin: true });
    configured();
    const input = await ctx.runQuery(internal.assist.summaryInput, { tripId });
    const text = await summarizeTrip(
      { ...trip, shortName: trip.stops[0]?.label ?? trip.destination.label },
      input.roster,
      input.schedule,
      locale !== "he"
    );
    if (text) await ctx.runMutation(internal.assist.saveSummary, { tripId, summary: text });
    return text;
  },
});
