import { contentLocale, isLocale } from "@together/i18n/config";
import { autocompleteDestination, resolveDestination } from "@together/integrations/destination";
import { geocodePlace } from "@together/integrations/import-place";
import { chooseDaysToRemove, generatePlan, type Outline, planDays } from "@together/integrations/planner";
import { daysBetween, resolveDatePhrase, shiftIso } from "@together/shared/holidays";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalAction } from "./_generated/server";
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



const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Changes the dates of a plan and lets the AI reshape it: a shorter trip drops the days that add least (and closes the
 * gaps), a longer one gets the extra days planned. A new start date moves everything. Organizers only.
 */
export const adjustDates = action({
  args: { tripId: v.id("trips"), startDate: v.string(), endDate: v.string() },
  handler: async (ctx, { tripId, startDate, endDate }): Promise<{ days: number; removed: number; added: number }> => {
    if (!ISO.test(startDate) || !ISO.test(endDate)) fail("invalid", "dates");
    const days = daysBetween(startDate, endDate);
    if (days < 1 || days > 30) fail("invalid", "dates");
    const info = await ctx.runQuery(internal.plannerData.adjustAccess, { tripId });
    const trip = info.trip;
    const before = daysBetween(trip.startDate, trip.endDate);
    // Booked items are real: never slide them to other dates
    const lastBooked = info.days.reduce((n, d) => (d.booked ? d.n : n), 0);
    if (lastBooked && startDate !== trip.startDate) fail("invalid", "bookings_in_the_way");
    if (lastBooked && days < before && before - days > before - lastBooked) fail("invalid", "bookings_in_the_way");
    await ctx.runMutation(internal.plannerData.moveStart, { tripId, startDate });

    if (days < before) {
      // With bookings only trailing days can go (they are after the last booking); otherwise the AI picks the weakest days
      const removeDays = lastBooked
        ? Array.from({ length: before - days }, (_, i) => before - i).sort((a, b) => a - b)
        : await chooseDaysToRemove(info.days, before - days, info.locale);
      await ctx.runMutation(internal.plannerData.trimDays, { tripId, removeDays });
      return { days, removed: before - days, added: 0 };
    }
    if (days === before) return { days, removed: 0, added: 0 };

    // Longer: plan the extra days at the end, in the last stop, avoiding what the earlier days already cover
    await ctx.runMutation(internal.plannerData.extendEnd, { tripId, endDate });
    const lastStop = trip.stops[trip.stops.length - 1];
    const outline: Outline = {
      title: trip.name,
      emoji: "sun",
      summary: trip.summary ?? "",
      datesReason: "",
      tips: [],
      startDate,
      endDate,
      stops: trip.stops.map((s, i) => ({
        label: s.label,
        country: s.country ?? "",
        nights: Math.max(1, daysBetween(s.startDate, s.endDate) - 1) + (i === trip.stops.length - 1 ? days - before : 0),
      })),
      group: { kind: trip.groupKind, name: "", adults: info.adults, kidAges: [] },
    };
    const covered = info.days.slice(-4).flatMap((d) => d.titles).slice(0, 14).join("; ");
    const extra = Array.from({ length: days - before }, (_, i) => before + 1 + i);
    const planned = await planDays(outline, { text: `${trip.name}. Add extra days at the end of the existing plan; do not repeat what is already planned (${covered}).`, locale: contentLocale(isLocale(info.locale) ? info.locale : "en") }, extra, () => lastStop.label);
    for (const day of planned) {
      const items = day.items.filter((item) => item.kind !== "stay");
      const wanted = [...new Set(items.filter((item) => item.kind !== "transport").map((item) => item.query))].slice(0, 12);
      const geos = new Map<string, Awaited<ReturnType<typeof geocodePlace>>>();
      await Promise.all(wanted.map(async (query) => void geos.set(query, await geocodePlace(query, `${lastStop.label} ${lastStop.country ?? ""}`).catch(() => null))));
      await ctx.runMutation(internal.chatTools.replaceDay, {
        tripId,
        day: shiftIso(startDate, day.dayNumber - 1),
        stopLabel: lastStop.label,
        authorName: trip.ai.name,
        items: items.map((item) => {
          const geo = geos.get(item.query) ?? null;
          return {
            time: item.time,
            title: item.title,
            kind: item.kind,
            durationMin: item.durationMin,
            why: item.why,
            query: item.query,
            geo: geo ? { lat: geo.lat, lng: geo.lng, ...(geo.address ? { address: geo.address } : {}), ...(geo.photoUrl ? { photoUrl: geo.photoUrl } : {}) } : null,
          };
        }),
      });
    }
    return { days, removed: 0, added: days - before };
  },
});
