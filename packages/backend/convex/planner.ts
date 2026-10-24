import { isLocale } from "@together/i18n/config";
import { autocompleteDestination, resolveDestination } from "@together/integrations/destination";
import { geocodePlace } from "@together/integrations/import-place";
import { generatePlan } from "@together/integrations/planner";
import { resolveDatePhrase } from "@together/shared/holidays";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";
import { fail } from "./lib/authz";
import { accountMutation, userQuery } from "./lib/functions";

/** The AI trip planner: free text → a tentative trip. The client calls `start` and watches `status`. */

const PLANS_PER_30_DAYS = 5;
const STALE_RUN_MS = 10 * 60_000;
const MAX_LOOKUPS = 45;

export const start = accountMutation({
  args: {
    text: v.string(),
    locale: v.optional(v.string()),
    hints: v.optional(
      v.object({
        groupKind: v.optional(v.string()),
        adults: v.optional(v.number()),
        kidAges: v.optional(v.array(v.number())),
        budget: v.optional(v.string()),
        pace: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, { text, locale, hints }) => {
    const clean = text.trim();
    if (clean.length < 8 || clean.length > 1500) fail("invalid", "text");
    if (!process.env.OPENAI_API_KEY) fail("invalid", "not_configured");
    const since = Date.now() - 30 * 86_400_000;
    const recent = await ctx.db
      .query("planRuns")
      .withIndex("by_user", (q) => q.eq("userId", ctx.user._id).gt("createdAt", since))
      .collect();
    if (recent.some((run) => run.status === "running" && Date.now() - run.createdAt < STALE_RUN_MS)) fail("limit", "plan_running");
    if (recent.filter((run) => run.status !== "failed").length >= PLANS_PER_30_DAYS) fail("limit", "plan_limit");
    const runId = await ctx.db.insert("planRuns", {
      userId: ctx.user._id,
      text: clean,
      locale: locale && isLocale(locale) ? locale : "en",
      status: "running",
      phase: "queued",
      createdAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.planner.run, { runId, ...(hints ? { hints } : {}) });
    return runId;
  },
});

export const status = userQuery({
  args: { runId: v.id("planRuns") },
  handler: async (ctx, { runId }) => {
    const run = await ctx.db.get(runId);
    if (!run || run.userId !== ctx.user._id) return null;
    return { status: run.status, phase: run.phase, detail: run.detail, tripId: run.tripId, error: run.error };
  },
});

/** How many plans are left this month, for the form. */
export const quota = userQuery({
  args: {},
  handler: async (ctx) => {
    const since = Date.now() - 30 * 86_400_000;
    const recent = await ctx.db
      .query("planRuns")
      .withIndex("by_user", (q) => q.eq("userId", ctx.user._id).gt("createdAt", since))
      .collect();
    return { left: Math.max(0, PLANS_PER_30_DAYS - recent.filter((run) => run.status !== "failed").length), limit: PLANS_PER_30_DAYS };
  },
});

async function inBatches<T, R>(items: T[], size: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(work))));
  return out;
}

export const run = internalAction({
  args: {
    runId: v.id("planRuns"),
    hints: v.optional(v.any()),
  },
  handler: async (ctx, { runId, hints }) => {
    const row = await ctx.runQuery(internal.plannerData.getRun, { runId });
    if (!row || row.status !== "running") return;
    const progress = async (phase: string, detail?: string) => {
      await ctx.runMutation(internal.plannerData.progress, { runId, phase, ...(detail ? { detail } : {}) });
    };
    try {
      const today = new Date().toISOString().slice(0, 10);
      const window = resolveDatePhrase(row.text, today);
      const { outline, days } = await generatePlan({ text: row.text, locale: row.locale, today, window, hints }, (phase, detail) => progress(phase, detail));

      await progress("places", "0");
      // Resolve each stop to a real destination (time zone, currency, cover photo)
      const stops = await Promise.all(
        outline.stops.map(async (stop) => {
          const suggestions = await autocompleteDestination(`${stop.label} ${stop.country}`.trim()).catch(() => []);
          const first = suggestions[0];
          return first ? await resolveDestination(first.placeId).catch(() => null) : null;
        })
      );
      if (!stops[0]) throw new ConvexError({ code: "invalid", detail: "destination_not_found" });
      const resolvedStops = stops.map((stop, i) => stop ?? { ...stops[0]!, label: outline.stops[i].label });

      // Look up the real places (photos and coordinates), most important first, within a fixed budget
      const order = { stay: 0, attraction: 1, activity: 2, restaurant: 3, transport: 9 } as const;
      const wanted = days
        .flatMap((day) => day.items.map((item) => ({ item, stop: day.stopLabel })))
        .filter(({ item }) => item.kind !== "transport")
        .sort((a, b) => order[a.item.kind] - order[b.item.kind]);
      const queries = [...new Map(wanted.map(({ item, stop }) => [item.query, stop])).entries()].slice(0, MAX_LOOKUPS);
      const geos: Record<string, { lat: number; lng: number; address?: string; photoUrl?: string } | null> = {};
      let done = 0;
      await inBatches(queries, 6, async ([query, stopLabel]) => {
        const stop = outline.stops.find((s) => s.label === stopLabel);
        geos[query] = await geocodePlace(query, stop ? `${stop.label} ${stop.country}` : "").catch(() => null);
        done++;
        if (done % 6 === 0) await progress("places", `${done}/${queries.length}`);
      });

      await progress("building");
      const tripId: Id<"trips"> = await ctx.runMutation(internal.plannerData.build, {
        runId,
        outline,
        days,
        stops: resolvedStops,
        // A list, not an object keyed by query: Convex field names must be plain ASCII
        geos: Object.entries(geos).map(([query, geo]) => ({ query, geo })),
      });
      void tripId;
    } catch (error) {
      const detail = error instanceof ConvexError ? String((error.data as { detail?: string })?.detail ?? "failed") : "failed";
      console.error("[planner] failed", error instanceof Error ? error.message : error);
      await ctx.runMutation(internal.plannerData.failRun, { runId, error: detail });
    }
  },
});

