import type { Locale } from "@together/i18n/config";
import { contentLocale } from "@together/i18n/config";
import { translate } from "@together/i18n/translate";
import {
  buildContext,
  type ChatPlace,
  type ChatStats,
  decorateCandidates,
  findSamePlace,
  resolveParticipants,
  resolvePlace,
  runChat,
  searchRatedPlaces,
  ToolArgs,
} from "@together/integrations/ai-chat";
import { systemPrompt } from "@together/integrations/ai-persona";
import { enrichPlace } from "@together/integrations/enrich";
import { geocodePlace, importPlaceFromUrl } from "@together/integrations/import-place";
import { type Infer, v } from "convex/values";
import OpenAI from "openai";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { type ActionCtx, internalAction } from "./_generated/server";
import { rosterLabel, speakerLine } from "./chat";
import { regionOf } from "./events";
import type { placeInput } from "./places";

/**
 * One guide reply: runs the OpenAI tool loop for a pending assistant
 * message and writes the result into it. Tool side effects go through
 * internal mutations that reuse the normal rules (dedupe, reminders, one
 * notification per action). Never leaves the message pending.
 */

type Context = NonNullable<Awaited<ReturnType<typeof loadContext>>>;

function loadContext(ctx: ActionCtx, replyId: Id<"chatMessages">) {
  return ctx.runQuery(internal.chat.runContext, { replyId });
}

function executor(ctx: ActionCtx, context: Context, locale: Locale, ideas: string[]) {
  const trip = context.trip;
  const tripId = trip._id;
  const places: ChatPlace[] = [...context.places];
  const speaker = speakerLine(locale, context.speakerName, context.speakerFamily);

  return async (name: string, raw: unknown): Promise<Record<string, unknown>> => {
    switch (name) {
      case "add_place": {
        const args = ToolArgs.add_place.parse(raw);
        const region = args.region?.trim() || regionOf(trip);
        // Never duplicate — reuse an existing place with a matching name
        const existing = findSamePlace(args.name, places);
        if (existing) {
          return { ok: true, placeId: existing.id, placeName: existing.name, summary: `"${existing.name}" כבר קיים במאגר — השתמש בו` };
        }
        let input: Infer<typeof placeInput>;
        if (args.url && /^https?:\/\//.test(args.url)) {
          const draft = await importPlaceFromUrl(args.url, region);
          input = {
            name: args.name || draft.name,
            category: args.category as Doc<"places">["category"],
            ...(draft.area ? { area: draft.area } : {}),
            ...(draft.address ? { address: draft.address } : {}),
            lat: draft.lat,
            lng: draft.lng,
            ...(draft.website ? { website: draft.website } : {}),
            ...(draft.imageUrl ? { imageUrl: draft.imageUrl } : {}),
            ...(draft.summary ? { summary: draft.summary } : {}),
            ...(draft.openingHours ? { openingHours: draft.openingHours } : {}),
            ...(draft.priceNotes ? { priceNotes: draft.priceNotes } : {}),
            ...(draft.tips ? { tips: draft.tips } : {}),
            sourceUrl: args.url,
          };
        } else {
          const geo = await geocodePlace(args.query?.trim() || args.name, region);
          if (!geo) {
            return { ok: false, error: `לא הצלחתי לאתר את "${args.query ?? args.name}" בגוגל — בקש מהמשתמש כתובת מדויקת יותר` };
          }
          input = {
            name: args.name,
            category: args.category as Doc<"places">["category"],
            ...(geo.address ? { address: geo.address } : {}),
            lat: geo.lat,
            lng: geo.lng,
            ...(geo.photoUrl ? { imageUrl: geo.photoUrl } : {}),
          };
        }
        const { id } = await ctx.runMutation(internal.chat.toolAddPlace, {
          tripId,
          input,
          createdByName: speaker ? `${speaker} (דרך ${trip.ai.name})` : trip.ai.name,
        });
        // Keep the context fresh so a chained create_event resolves it
        places.push({ id, name: input.name, category: input.category });
        return {
          ok: true,
          placeId: id,
          placeName: input.name,
          summary: `המקום "${input.name}" נוצר עם מיקום${input.imageUrl ? ", תמונה" : ""}${input.address ? ` (${input.address})` : ""}`,
        };
      }

      case "search_google_places": {
        const args = ToolArgs.search_google_places.parse(raw);
        return searchRatedPlaces(args.query, args.region?.trim() || regionOf(trip), args.minRating);
      }

      case "create_event": {
        const args = ToolArgs.create_event.parse(raw);
        if (args.day < trip.startDate || args.day > trip.endDate) {
          return { ok: false, error: `התאריך ${args.day} מחוץ לטווח הטיול` };
        }
        const place = resolvePlace(args.placeName, places);
        const startTime = args.startTime.length === 4 ? `0${args.startTime}` : args.startTime;
        const who = resolveParticipants(args.participants, context.families);
        const eventId = await ctx.runMutation(internal.chat.toolCreateEvent, {
          tripId,
          title: args.title,
          ...(args.emoji ? { emoji: args.emoji } : {}),
          day: args.day,
          startTime,
          ...(args.durationMin ? { durationMin: args.durationMin } : {}),
          placeId: (place?.id as Id<"places"> | undefined) ?? null,
          participants:
            who.type === "families" ? { type: "families", familyIds: who.familyIds as Id<"families">[] } : who,
          notes: args.notes ?? "",
        });
        return {
          ok: true,
          eventId,
          summary: `נוצר אירוע "${args.title}" ב-${args.day} בשעה ${startTime}${place ? ` (מקושר ל-${place.name})` : ""}`,
        };
      }

      case "enrich_place": {
        const args = ToolArgs.enrich_place.parse(raw);
        const target = resolvePlace(args.placeName, places);
        if (!target) return { ok: false, error: `לא נמצא מקום שמור בשם "${args.placeName}"` };
        const place = await ctx.runQuery(internal.chat.placeForEnrich, { placeId: target.id as Id<"places"> });
        if (!place) return { ok: false, error: "המקום לא נמצא" };
        const result = await enrichPlace(place, {
          region: regionOf(trip),
          shortName: trip.stops[0]?.label ?? trip.destination.label,
          audience: trip.legacyKey === "sicily" ? "למשפחות" : "למטיילים",
          explicitUrl: args.url,
          locale: contentLocale(locale),
        });
        if (result.ok) await ctx.runMutation(internal.places.patchInternal, { placeId: place._id, patch: result.updates });
        return { ok: result.ok, summary: result.message };
      }

      case "create_poll": {
        const args = ToolArgs.create_poll.parse(raw);
        const options = args.options.map((option) => ({
          label: option.label,
          placeId: (resolvePlace(option.placeName ?? option.label, places)?.id as Id<"places"> | undefined) ?? null,
        }));
        const pollId = await ctx.runMutation(internal.chat.toolCreatePoll, { tripId, question: args.question, options });
        return { ok: true, pollId, summary: `נוצר סקר "${args.question}" עם ${options.length} אפשרויות וכולם קיבלו התראה` };
      }

      case "add_poll_option": {
        const args = ToolArgs.add_poll_option.parse(raw);
        const place = resolvePlace(args.placeName ?? args.label, places);
        const result = await ctx.runMutation(internal.chat.toolAddIdea, {
          tripId,
          label: args.label,
          placeId: (place?.id as Id<"places"> | undefined) ?? null,
          locale,
        });
        if (result === "exists") return { ok: true, summary: `"${args.label}" כבר נמצא בסקר הקבוצתי` };
        ideas.push(args.label);
        return { ok: true, summary: `"${args.label}" נוסף לסקר הרעיונות` };
      }

      default:
        return { ok: false, error: "unknown_tool" };
    }
  };
}

export const run = internalAction({
  args: { replyId: v.id("chatMessages"), locale: v.string() },
  handler: async (ctx, { replyId, locale: rawLocale }): Promise<void> => {
    const locale: Locale = rawLocale === "en" || rawLocale === "ar" || rawLocale === "es" ? rawLocale : "he";
    const context = await loadContext(ctx, replyId);
    if (!context) return;
    const failWith = (key: "ai.errors.failed" | "ai.errors.notConfigured") =>
      ctx.runMutation(internal.chat.failReply, { replyId, content: translate(locale, key) });

    if (!process.env.OPENAI_API_KEY) {
      await failWith("ai.errors.notConfigured");
      return;
    }
    const trip = context.trip;
    const ideas: string[] = [];
    const startedAt = Date.now();
    const stats: ChatStats = { firstEffort: "low", rounds: 0, llmMs: 0, toolMs: 0, tools: [], promptTokens: 0, completionTokens: 0 };
    let decorateMs = 0;
    let ok = false;
    try {
      const answer = await runChat({
        stats,
        openai: new OpenAI(),
        system: systemPrompt(trip, locale),
        context: buildContext({
          timezone: trip.timezone,
          startDate: trip.startDate,
          endDate: trip.endDate,
          stops: trip.stops,
          homeBase: trip.homeBase,
          homeBaseLabel: trip.legacyKey ? "הוילה" : "מקום הלינה",
          rosterLabel: rosterLabel(trip),
          aboutUs: trip.aboutUs ?? "",
          families: context.families,
          places: context.places,
          events: context.events,
          polls: context.polls,
        }),
        speaker: speakerLine(locale, context.speakerName, context.speakerFamily),
        turns: context.turns,
        range: { startDate: trip.startDate, endDate: trip.endDate },
        execute: executor(ctx, context, locale, ideas),
      });
      const decorating = Date.now();
      const candidates = await decorateCandidates(answer.candidates, regionOf(trip));
      decorateMs = Date.now() - decorating;
      await ctx.runMutation(internal.chat.finish, { replyId, content: answer.reply, candidates });
      ok = true;
    } catch (error) {
      console.error("[chat] run failed", error);
      await failWith("ai.errors.failed");
    } finally {
      const totalMs = Date.now() - startedAt;
      console.log(`[chat] ${ok ? "ok" : "failed"} total=${totalMs}ms llm=${stats.llmMs}ms tools=${stats.toolMs}ms decorate=${decorateMs}ms rounds=${stats.rounds} effort=${stats.firstEffort} tokens=${stats.promptTokens}+${stats.completionTokens} [${stats.tools.join(",")}]`);
      await ctx.runMutation(internal.chat.logRun, {
        tripId: trip._id,
        ok,
        totalMs,
        llmMs: stats.llmMs,
        toolMs: stats.toolMs,
        decorateMs,
        rounds: stats.rounds,
        firstEffort: stats.firstEffort,
        tools: stats.tools,
        promptTokens: stats.promptTokens,
        completionTokens: stats.completionTokens,
        model: process.env.OPENAI_MODEL ?? "gpt-5.1",
      }).catch(() => undefined);
      await ctx.runMutation(internal.chat.notifyIdeas, { tripId: trip._id, labels: ideas, excludeUserId: context.ownerId });
    }
  },
});
