import { isLocale } from "@together/i18n/config";
import { translate } from "@together/i18n/translate";
import { shiftIso } from "@together/shared/holidays";
import { randomId } from "@together/shared/trip-doc";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./_generated/server";
import { insertEvent } from "./events";
import { insertPlace } from "./places";
import { createTripFor } from "./trips";

/** Database side of the AI planner (the action in planner.ts does the model and Google calls). */

export const getRun = internalQuery({
  args: { runId: v.id("planRuns") },
  handler: async (ctx, { runId }) => ctx.db.get(runId),
});

export const progress = internalMutation({
  args: { runId: v.id("planRuns"), phase: v.string(), detail: v.optional(v.string()) },
  handler: async (ctx, { runId, phase, detail }) => {
    await ctx.db.patch(runId, { phase, detail });
  },
});

export const failRun = internalMutation({
  args: { runId: v.id("planRuns"), error: v.string() },
  handler: async (ctx, { runId, error }) => {
    await ctx.db.patch(runId, { status: "failed", error });
  },
});

const EMOJI = { attraction: "pin", restaurant: "dining", stay: "hotel", transport: "car", activity: "ticket" } as const;
const CATEGORY = { attraction: "attraction", activity: "attraction", restaurant: "restaurant", stay: "accommodation" } as const;

const pad = (time: string) => {
  const [h, m] = time.split(":");
  return `${String(Math.min(23, Number(h) || 0)).padStart(2, "0")}:${String(Math.min(59, Number(m) || 0)).padStart(2, "0")}`;
};

/** Drops the trailing city from a search query so the saved place has a clean name. */
const placeName = (query: string, stop: string, fallback: string) => {
  const stripped = query.replace(new RegExp(`[\\s,]*${stop.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i"), "").trim();
  return stripped.length >= 2 ? stripped : fallback;
};

export const build = internalMutation({
  args: {
    runId: v.id("planRuns"),
    outline: v.any(),
    days: v.any(),
    stops: v.any(),
    geos: v.any(),
  },
  handler: async (ctx, { runId, outline, days, stops, geos: geoList }) => {
    const geos = new Map<string, { lat: number; lng: number; address?: string; photoUrl?: string } | null>((geoList as { query: string; geo: never }[]).map((entry) => [entry.query, entry.geo]));
    const run = await ctx.db.get(runId);
    if (!run) throw new Error("run_missing");
    const user = await ctx.db.get(run.userId);
    if (!user) throw new Error("user_missing");
    const lang = isLocale(run.locale) ? run.locale : "en";
    const t = (key: string, params?: Record<string, string | number>) => translate(lang, key as never, params as never);

    // Stops: consecutive date ranges from the planned start
    let cursor: string = outline.startDate;
    const stopInputs = outline.stops.map((stop: { label: string; nights: number }, i: number) => {
      const resolved = stops[i];
      const startDate = cursor;
      const endDate = shiftIso(startDate, stop.nights);
      cursor = endDate;
      return {
        id: `s-${randomId(6)}`,
        // The model names stops in the traveller's language; Places returns Hebrew names
        label: String(stop.label || resolved.label).slice(0, 80),
        ...(resolved.placeId ? { placeId: resolved.placeId } : {}),
        lat: resolved.lat,
        lng: resolved.lng,
        region: resolved.region ?? "",
        ...(resolved.country ? { country: resolved.country } : {}),
        timezone: resolved.timezone,
        currency: resolved.currency,
        coverImage: resolved.coverImage ?? null,
        startDate,
        endDate,
      };
    });

    // Who is coming: a family unit when there are kids, otherwise every adult is their own unit
    const meName = (user.name ?? "").trim().split(/\s+/)[0] || t("creator.defaults.me");
    const adults = Math.max(1, Number(outline.group.adults) || 1);
    const kidAges: number[] = outline.group.kidAges ?? [];
    const familyUnit = outline.group.kind === "families" || kidAges.length > 0;
    const person = (n: number) => (n === 1 ? meName : t("creator.defaults.person", { n }));
    const mkMember = (name: string, kid = false, age: number | null = null) => ({ id: `m-${randomId(6)}`, name, ...(kid ? { kid: true, age } : {}) });
    const families = familyUnit
      ? [
          {
            id: `f-${randomId(6)}`,
            name: (user.name ?? "").trim().split(/\s+/).slice(1).join(" ")
              ? t("creator.defaults.familyOf", { name: (user.name ?? "").trim().split(/\s+/).slice(1).join(" ") })
              : t("creator.defaults.myFamily"),
            members: [
              ...Array.from({ length: adults }, (_, i) => mkMember(person(i + 1))),
              ...kidAges.map((age, i) => mkMember(t("creator.defaults.childN", { n: i + 1 }), true, age)),
            ],
          },
        ]
      : Array.from({ length: adults }, (_, i) => ({ id: `f-${randomId(6)}`, name: person(i + 1), members: [mkMember(person(i + 1))] }));

    const input = {
      name: String(outline.title).slice(0, 60),
      emoji: outline.emoji,
      stops: stopInputs,
      departureAt: null,
      homeBase: null,
      groupKind: outline.group.kind,
      groupName: String(outline.group.name ?? "").slice(0, 40),
      families,
      ai: { name: t("creator.ai.presets.butler.name"), emoji: "butler", avatar: { kind: "bot" as const, id: "butler" }, preset: "butler" as const, rules: [], customRules: "" },
      me: { familyId: families[0].id, memberId: families[0].members[0].id },
      status: "active" as const,
    };

    const notes = [outline.datesReason, ...(outline.tips ?? []).map((tip: string) => `• ${tip}`)].filter(Boolean).join("\n").slice(0, 2500);
    const tripId = await createTripFor(ctx, user, input, {
      invites: false,
      extra: { tentative: true, datesApproximate: true, plannedFrom: "ai", planPrompt: run.text.slice(0, 1500), planNotes: notes, summary: String(outline.summary).slice(0, 800) },
    });
    const trip = (await ctx.db.get(tripId)) as Doc<"trips">;
    const author = { userId: user._id, name: user.name ?? undefined };

    let events = 0;
    let places = 0;
    for (const day of days as { dayNumber: number; stopLabel: string; items: { time: string; title: string; kind: keyof typeof EMOJI; query: string; durationMin: number; why: string }[] }[]) {
      const date = shiftIso(outline.startDate, day.dayNumber - 1);
      const stop = stopInputs.find((s: { label: string }) => s.label === day.stopLabel) ?? stopInputs.find((s: { startDate: string; endDate: string }) => date >= s.startDate && date <= s.endDate);
      for (const item of day.items) {
        let placeId: Id<"places"> | null = null;
        const geo = item.kind === "transport" ? null : (geos.get(item.query) ?? null);
        if (geo) {
          const result = await insertPlace(
            ctx,
            tripId,
            {
              name: placeName(item.query, day.stopLabel, item.title).slice(0, 120),
              category: CATEGORY[item.kind as keyof typeof CATEGORY],
              ...(stop ? { area: stop.label } : {}),
              ...(geo.address ? { address: geo.address } : {}),
              lat: geo.lat,
              lng: geo.lng,
              ...(geo.photoUrl ? { imageUrl: geo.photoUrl } : {}),
              ...(item.why ? { tips: item.why } : {}),
              recommendedDurationMin: item.durationMin,
            },
            author
          );
          placeId = result.id;
          if (!result.existed) {
            places++;
            await ctx.db.patch(result.id, {
              source: "ai_plan",
              ...(item.kind === "stay" && stop ? { stayFrom: date, stayTo: stop.endDate } : {}),
            });
          }
        }
        const eventId = await insertEvent(
          ctx,
          trip,
          { title: item.title.slice(0, 120), emoji: EMOJI[item.kind], placeId, day: date, startTime: pad(item.time), durationMin: item.durationMin, participants: { type: "all" }, notes: item.why },
          author,
          { notify: false }
        );
        await ctx.db.patch(eventId, { source: "ai_plan" });
        events++;
      }
    }
    await ctx.db.patch(runId, { status: "done", phase: "done", tripId, detail: `${events} events, ${places} places` });
    return tripId;
  },
});

